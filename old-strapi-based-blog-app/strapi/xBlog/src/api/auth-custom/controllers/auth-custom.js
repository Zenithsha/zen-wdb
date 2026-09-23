'use strict';

module.exports = {
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Not authenticated');

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: ['role', 'profilePicture'],
    });

    if (!user) return ctx.notFound('User not found');

    const { password: _p, resetPasswordToken: _r, confirmationToken: _c, ...safe } = user;
    ctx.send(safe);
  },

  /**
   * GET /auth/mention-search?q=foo
   * Returns up to 10 users whose username or displayName matches `q`.
   * Auth required so we don't expose user listings to anonymous scrapers.
   * Returns ONLY safe fields — no email, no role, no internal flags.
   */
  async mentionSearch(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const q = String(ctx.query.q || '').trim();
    const articleDocumentId = String(ctx.query.articleDocumentId || '').trim();

    // ── Build the candidate pool ─────────────────────────────────────
    // Primary scope: the article's author + everyone who has commented on
    // it. Always include the caller too (Twitter / Slack-style — you can
    // tag yourself if you want).
    const candidateIds = new Set();

    if (articleDocumentId) {
      const article = await strapi.documents('api::article.article').findOne({
        documentId: articleDocumentId,
        populate: { author: { fields: ['id'] } },
      });
      if (article?.author?.id) candidateIds.add(article.author.id);

      const comments = await strapi.db.query('api::comment.comment').findMany({
        where: { article: { documentId: articleDocumentId } },
        populate: { user: { select: ['id'] } },
        limit: 500,
      });
      for (const c of comments) {
        if (c.user?.id) candidateIds.add(c.user.id);
      }
    }

    // Always include the caller — they may want to tag themselves.
    if (ctx.state.user?.id) candidateIds.add(ctx.state.user.id);

    // ── Query the scoped pool ────────────────────────────────────────
    let data = [];
    if (candidateIds.size > 0) {
      const where = {
        id: { $in: Array.from(candidateIds) },
        blocked: false,
      };
      if (q) {
        where.$or = [
          { username: { $containsi: q } },
          { displayName: { $containsi: q } },
        ];
      }
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        where,
        populate: ['profilePicture'],
        limit: 10,
      });
      data = users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        profilePicture: u.profilePicture
          ? { url: u.profilePicture.url, formats: u.profilePicture.formats }
          : null,
      }));
    }

    // ── Fallback: when the article has no contributors yet OR none match,
    // fall through to a global username search so brand-new articles
    // still have a usable mention experience. Only kicks in once the
    // user has typed something to narrow the result set.
    if (data.length === 0 && q) {
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: {
          blocked: false,
          $or: [
            { username: { $containsi: q } },
            { displayName: { $containsi: q } },
          ],
        },
        populate: ['profilePicture'],
        limit: 10,
      });
      data = users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        profilePicture: u.profilePicture
          ? { url: u.profilePicture.url, formats: u.profilePicture.formats }
          : null,
      }));
    }

    return ctx.send({ data });
  },

  /**
   * GET /auth/profile/:username
   * Public — returns safe public profile fields + a count of the user's
   * published articles. Used by the /profile/[username] page.
   */
  async publicProfile(ctx) {
    const username = String(ctx.params.username || '').trim();
    if (!username) return ctx.badRequest('username required');

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username },
      populate: ['role', 'profilePicture'],
    });
    if (!user) return ctx.notFound('User not found');

    const articlesCount = await strapi.db.query('api::article.article').count({
      where: { author: { id: user.id }, status: 'published' },
    });

    // Sum view counts across the user's published articles.
    const articles = await strapi.db.query('api::article.article').findMany({
      where: { author: { id: user.id }, status: 'published' },
      select: ['viewCount'],
    });
    const totalViews = articles.reduce((sum, a) => sum + (a.viewCount || 0), 0);

    return ctx.send({
      data: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        displayName: user.displayName || user.username,
        bio: user.bio || null,
        socialLinks: user.socialLinks || {},
        profilePicture: user.profilePicture
          ? { url: user.profilePicture.url, formats: user.profilePicture.formats }
          : null,
        role: user.role ? { type: user.role.type, name: user.role.name } : null,
        createdAt: user.createdAt,
        stats: {
          articles: articlesCount,
          views: totalViews,
        },
      },
    });
  },

  /**
   * PATCH /auth/me
   * Auth required — updates fields on the currently signed-in user's
   * own profile. Whitelisted fields only so the caller can't escalate
   * privileges or change their password through this route.
   */
  async updateMe(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
    const body = ctx.request.body?.data || ctx.request.body || {};

    const data = {};
    if (typeof body.displayName === 'string') data.displayName = body.displayName.trim().slice(0, 80);
    if ('bio' in body) data.bio = typeof body.bio === 'string' ? body.bio.slice(0, 500) : null;
    if (body.socialLinks && typeof body.socialLinks === 'object') {
      const allowed = ['github', 'twitter', 'linkedin', 'website'];
      const clean = {};
      for (const key of allowed) {
        const val = body.socialLinks[key];
        if (typeof val === 'string' && val.trim()) clean[key] = val.trim().slice(0, 300);
      }
      data.socialLinks = clean;
    }
    if (typeof body.profilePicture === 'number') data.profilePicture = body.profilePicture;
    if (body.profilePicture === null) data.profilePicture = null;

    if (Object.keys(data).length === 0) return ctx.badRequest('No fields to update');

    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: ctx.state.user.id },
      data,
      populate: ['role', 'profilePicture'],
    });

    const { password: _p, resetPasswordToken: _r, confirmationToken: _c, ...safe } = updated;
    return ctx.send({ data: safe });
  },

  /**
   * POST /auth/upgrade-to-blogger
   * Self-service: an `authenticated` (reader) user converts their own
   * account into a `blogger` so they can write articles. Idempotent —
   * if already a blogger or admin, just returns the current user.
   */
  async upgradeToBlogger(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const userId = ctx.state.user.id;

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      populate: ['role'],
    });
    if (!user) return ctx.notFound();

    // Already a blogger or admin? No-op.
    if (user.role && (user.role.type === 'blogger' || user.role.type === 'admin')) {
      const { password: _p, resetPasswordToken: _r, confirmationToken: _c, ...safe } = user;
      return ctx.send({ data: safe });
    }

    // Only allow upgrading from the plain authenticated role.
    if (!user.role || user.role.type !== 'authenticated') {
      return ctx.badRequest('Only reader accounts can be upgraded');
    }

    const bloggerRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'blogger' },
    });
    if (!bloggerRole) return ctx.badRequest('Blogger role not found');

    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: userId },
      data: { role: bloggerRole.id },
      populate: ['role', 'profilePicture'],
    });

    const { password: _p, resetPasswordToken: _r, confirmationToken: _c, ...safe } = updated;
    return ctx.send({ data: safe });
  },

  async registerPublic(ctx) {
    const { username, email, password, accountType } = ctx.request.body || {};

    if (!username || !email || !password) {
      return ctx.badRequest('username, email, and password are required');
    }

    // Whitelist account types — admin CANNOT be self-assigned
    const type = accountType === 'blogger' ? 'blogger' : 'authenticated';

    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type } });

    if (!role) {
      return ctx.badRequest(`Role '${type}' not found`);
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const trimmedUsername = String(username).trim();

    // Usernames must be globally unique CASE-INSENSITIVELY so mentions
    // (which match `@uname` case-insensitively) always resolve to one
    // specific user. Reject any registration where someone has already
    // claimed the same name in any casing — even if the existing row's
    // username happens to differ in capitalisation.
    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: normalizedEmail },
          { username: { $eqi: trimmedUsername } },
        ],
      },
    });

    if (existing) {
      // Differentiate the failure mode so the form can render the right
      // error message.
      const conflict =
        existing.email === normalizedEmail
          ? 'Email already in use'
          : `Username "${existing.username}" is already taken`;
      return ctx.badRequest(conflict);
    }

    const user = await strapi.plugin('users-permissions').service('user').add({
      username: trimmedUsername,
      email: normalizedEmail,
      password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
    });

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    // Manual sanitization — strip sensitive fields
    const { password: _pw, resetPasswordToken: _rpt, confirmationToken: _ct, ...safeUser } = user;

    ctx.send({
      jwt,
      user: { ...safeUser, role: { id: role.id, type: role.type, name: role.name } },
    });
  },
};
