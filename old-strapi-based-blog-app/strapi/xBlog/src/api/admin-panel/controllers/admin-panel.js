'use strict';

const sanitizeUser = (u) => {
  if (!u) return u;
  const { password, resetPasswordToken, confirmationToken, ...rest } = u;
  return rest;
};

module.exports = {
  // ── Admin login ─────────────────────────────────────────────────────
  async login(ctx) {
    const { identifier, password } = ctx.request.body || {};
    if (!identifier || !password) {
      return ctx.badRequest('identifier and password are required');
    }

    const normalized = String(identifier).toLowerCase().trim();

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { $or: [{ email: normalized }, { username: identifier }] },
      populate: ['role'],
    });

    if (!user) return ctx.unauthorized('Invalid credentials');
    if (user.blocked) return ctx.forbidden('Account is blocked');
    if (!user.role || user.role.type !== 'admin') {
      return ctx.forbidden('Not an admin account');
    }

    const validPassword = await strapi.plugin('users-permissions').service('user')
      .validatePassword(password, user.password);

    if (!validPassword) return ctx.unauthorized('Invalid credentials');

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });
    return ctx.send({ jwt, user: sanitizeUser(user) });
  },

  // ── Dashboard overview ──────────────────────────────────────────────
  async dashboard(ctx) {
    const [
      totalArticles,
      draftArticles,
      pendingArticles,
      publishedArticles,
      rejectedArticles,
      totalComments,
      totalReactions,
    ] = await Promise.all([
      strapi.documents('api::article.article').count({}),
      strapi.documents('api::article.article').count({ filters: { status: 'draft' } }),
      strapi.documents('api::article.article').count({ filters: { status: 'pending' } }),
      strapi.documents('api::article.article').count({ filters: { status: 'published' } }),
      strapi.documents('api::article.article').count({ filters: { status: 'rejected' } }),
      strapi.documents('api::comment.comment').count({}),
      strapi.documents('api::reaction.reaction').count({}),
    ]);

    const bloggerRole = await strapi.db.query('plugin::users-permissions.role')
      .findOne({ where: { type: 'blogger' } });
    const authRole = await strapi.db.query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    const totalBloggers = bloggerRole
      ? await strapi.db.query('plugin::users-permissions.user').count({ where: { role: { id: bloggerRole.id } } })
      : 0;
    const totalViewers = authRole
      ? await strapi.db.query('plugin::users-permissions.user').count({ where: { role: { id: authRole.id } } })
      : 0;
    const totalUsers = await strapi.db.query('plugin::users-permissions.user').count({});
    const blockedUsers = await strapi.db.query('plugin::users-permissions.user').count({ where: { blocked: true } });

    const recentPending = await strapi.documents('api::article.article').findMany({
      filters: { status: 'pending' },
      sort: { createdAt: 'desc' },
      limit: 5,
      populate: ['author', 'tags'],
    });

    const recentPublished = await strapi.documents('api::article.article').findMany({
      filters: { status: 'published' },
      sort: { updatedAt: 'desc' },
      limit: 5,
      populate: ['author', 'tags'],
    });

    return ctx.send({
      data: {
        stats: {
          articles: {
            total: totalArticles,
            draft: draftArticles,
            pending: pendingArticles,
            published: publishedArticles,
            rejected: rejectedArticles,
          },
          users: { total: totalUsers, bloggers: totalBloggers, viewers: totalViewers, blocked: blockedUsers },
          totalComments,
          totalReactions,
        },
        recentPending,
        recentPublished,
      },
    });
  },

  // ── Users ───────────────────────────────────────────────────────────
  async listUsers(ctx) {
    const { role, q, blocked } = ctx.query;
    const where = {};
    if (role) {
      const roleRow = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: String(role) } });
      if (roleRow) where.role = { id: roleRow.id };
    }
    if (q) {
      where.$or = [
        { username: { $containsi: String(q) } },
        { email: { $containsi: String(q) } },
      ];
    }
    if (blocked === 'true') where.blocked = true;
    if (blocked === 'false') where.blocked = false;

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where,
      populate: ['role', 'profilePicture'],
      orderBy: { createdAt: 'desc' },
      limit: 200,
    });

    const articleCounts = await Promise.all(
      users.map((u) =>
        strapi.db.query('api::article.article').count({ where: { author: { id: u.id } } })
      )
    );

    const data = users.map((u, i) => ({
      ...sanitizeUser(u),
      articleCount: articleCounts[i],
    }));

    return ctx.send({ data });
  },

  async createBlogger(ctx) {
    const { email, username, password, displayName } = ctx.request.body?.data || {};
    if (!email || !username || !password) return ctx.badRequest('email, username, and password are required');

    // Username uniqueness is enforced CASE-INSENSITIVELY because the
    // @mention parser matches insensitively — two users with the same
    // letters in different casing would be indistinguishable.
    const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: String(email).toLowerCase().trim() },
          { username: { $eqi: String(username).trim() } },
        ],
      },
    });
    if (existingUser) return ctx.badRequest('A user with this email or username already exists');

    const bloggerRole = await strapi.db.query('plugin::users-permissions.role')
      .findOne({ where: { type: 'blogger' } });
    if (!bloggerRole) return ctx.badRequest('Blogger role does not exist');

    const hashedPassword = await strapi.plugin('users-permissions').service('user').hashPassword({ password });

    const newUser = await strapi.db.query('plugin::users-permissions.user').create({
      data: {
        email: String(email).toLowerCase().trim(),
        username,
        password: hashedPassword,
        displayName: displayName || username,
        role: bloggerRole.id,
        confirmed: true,
        blocked: false,
        mustChangePassword: true,
      },
      populate: ['role'],
    });

    return ctx.send({ data: sanitizeUser(newUser) });
  },

  async blockUser(ctx) {
    const { id } = ctx.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return ctx.badRequest('Invalid user id');
    if (!ctx.state.user) return ctx.unauthorized();
    if (numId === ctx.state.user.id) return ctx.badRequest('Cannot block yourself');
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: numId } });
    if (!existing) return ctx.notFound('User not found');
    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: numId },
      data: { blocked: true },
      populate: ['role'],
    });
    return ctx.send({ data: sanitizeUser(updated) });
  },

  async unblockUser(ctx) {
    const { id } = ctx.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return ctx.badRequest('Invalid user id');
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: numId } });
    if (!existing) return ctx.notFound('User not found');
    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: numId },
      data: { blocked: false },
      populate: ['role'],
    });
    return ctx.send({ data: sanitizeUser(updated) });
  },

  async setUserRole(ctx) {
    const { id } = ctx.params;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return ctx.badRequest('Invalid user id');
    if (!ctx.state.user) return ctx.unauthorized();
    const { roleType } = ctx.request.body?.data || ctx.request.body || {};
    if (!['authenticated', 'blogger', 'admin'].includes(roleType)) {
      return ctx.badRequest('Invalid roleType');
    }
    // Prevent an admin from demoting themselves and accidentally locking out the panel
    if (numId === ctx.state.user.id && roleType !== 'admin') {
      return ctx.badRequest('You cannot change your own admin role');
    }
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { id: numId } });
    if (!existing) return ctx.notFound('User not found');
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: roleType } });
    if (!role) return ctx.badRequest('Role not found');
    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: numId },
      data: { role: role.id },
      populate: ['role'],
    });
    return ctx.send({ data: sanitizeUser(updated) });
  },

  // ── Articles ────────────────────────────────────────────────────────
  async listArticles(ctx) {
    const { status, q } = ctx.query;
    const filters = {};
    if (status) filters.status = String(status);
    if (q) filters.title = { $containsi: String(q) };

    const articles = await strapi.documents('api::article.article').findMany({
      filters,
      sort: { createdAt: 'desc' },
      limit: 200,
      populate: ['author', 'tags'],
    });

    return ctx.send({ data: articles });
  },

  async unpublishArticle(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Missing article id');
    const existing = await strapi.documents('api::article.article').findOne({ documentId: id });
    if (!existing) return ctx.notFound('Article not found');
    const updated = await strapi.documents('api::article.article').update({
      documentId: id,
      data: { status: 'draft' },
      populate: ['author'],
    });
    return ctx.send({ data: updated });
  },

  async deleteArticle(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Missing article id');
    const existing = await strapi.documents('api::article.article').findOne({ documentId: id });
    if (!existing) return ctx.notFound('Article not found');
    await strapi.documents('api::article.article').delete({ documentId: id });
    return ctx.send({ data: { documentId: id, deleted: true } });
  },

  // ── Comments ────────────────────────────────────────────────────────
  async listComments(ctx) {
    const comments = await strapi.documents('api::comment.comment').findMany({
      sort: { createdAt: 'desc' },
      limit: 200,
      populate: ['user', 'article'],
    });
    return ctx.send({ data: comments });
  },

  async deleteComment(ctx) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Missing comment id');
    const existing = await strapi.documents('api::comment.comment').findOne({ documentId: id });
    if (!existing) return ctx.notFound('Comment not found');
    await strapi.documents('api::comment.comment').delete({ documentId: id });
    return ctx.send({ data: { documentId: id, deleted: true } });
  },
};
