'use strict';

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    // ── 1. Ensure 'blogger' role exists ──────────────────────────────────
    let bloggerRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'blogger' } });

    if (!bloggerRole) {
      bloggerRole = await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Blogger',
          type: 'blogger',
          description: 'Content creator role with article management access',
        },
      });
      strapi.log.info('✅ Created blogger role');
    }

    // ── 1b. Ensure 'admin' role exists (frontend admin, separate from Strapi panel admin) ──
    let adminRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'admin' } });

    if (!adminRole) {
      adminRole = await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Admin',
          type: 'admin',
          description: 'Platform admin — can approve/reject articles and manage users',
        },
      });
      strapi.log.info('✅ Created admin role');
    }

    // ── 2. Seed permissions ───────────────────────────────────────────────
    await seedPermissions(strapi);

    // ── 3. Auto-promote first admin if env var is set ─────────────────────
    const seedEmail = process.env.SEED_ADMIN_EMAIL;
    if (seedEmail) {
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: String(seedEmail).toLowerCase().trim() },
        populate: ['role'],
      });
      if (user && user.role?.type !== 'admin') {
        await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { role: adminRole.id },
        });
        strapi.log.info(`✅ Promoted ${seedEmail} to admin role`);
      }
    }
  },
};

/**
 * Grant permissions to roles based on a declarative map.
 * Safe to re-run on every restart — only inserts missing rows.
 */
async function seedPermissions(strapi) {
  const permMap = {
    // ── Public ────────────────────────────────────────────────────────────
    // Anyone — even logged-out — can read articles, tags, comments and reactions.
    // Writing (create/update/delete) still requires auth.
    public: [
      { action: 'api::article.article.find' },
      { action: 'api::article.article.findOne' },
      { action: 'api::article.article.incrementView' },
      { action: 'api::tag.tag.find' },
      { action: 'api::tag.tag.findOne' },
      { action: 'api::comment.comment.find' },
      { action: 'api::comment.comment.findOne' },
      { action: 'api::reaction.reaction.find' },
      { action: 'api::announcement.announcement.find' },
      { action: 'api::announcement.announcement.findOne' },
      { action: 'api::announcement.announcement.active' },
      { action: 'api::newsletter-signup.newsletter-signup.subscribe' },
      { action: 'api::auth-custom.auth-custom.publicProfile' },
    ],
    // ── Authenticated (viewer/reader) ─────────────────────────────────────
    authenticated: [
      { action: 'api::article.article.find' },
      { action: 'api::article.article.findOne' },
      { action: 'api::article.article.incrementView' },
      { action: 'api::tag.tag.find' },
      { action: 'api::tag.tag.findOne' },
      { action: 'api::comment.comment.find' },
      { action: 'api::comment.comment.findOne' },
      { action: 'api::comment.comment.create' },
      { action: 'api::comment.comment.update' },
      { action: 'api::comment.comment.delete' },
      { action: 'api::comment.comment.toggleLike' },
      { action: 'api::reaction.reaction.find' },
      { action: 'api::reaction.reaction.create' },
      { action: 'api::reaction.reaction.delete' },
      { action: 'api::subscription.subscription.find' },
      { action: 'api::subscription.subscription.create' },
      { action: 'api::subscription.subscription.update' },
      { action: 'api::subscription.subscription.delete' },
      { action: 'plugin::users-permissions.user.me' },
      { action: 'api::auth-custom.auth-custom.me' },
      { action: 'api::auth-custom.auth-custom.mentionSearch' },
      { action: 'api::auth-custom.auth-custom.publicProfile' },
      { action: 'api::auth-custom.auth-custom.updateMe' },
      { action: 'api::auth-custom.auth-custom.upgradeToBlogger' },
      { action: 'api::notification.notification.me' },
      { action: 'api::notification.notification.markRead' },
      { action: 'api::notification.notification.markAllRead' },
      { action: 'api::notification.notification.removeOne' },
      { action: 'api::notification.notification.clearAll' },
      { action: 'api::notification.notification.sendTest' },
    ],
    // ── Blogger ───────────────────────────────────────────────────────────
    blogger: [
      { action: 'api::article.article.find' },
      { action: 'api::article.article.findOne' },
      { action: 'api::article.article.create' },
      { action: 'api::article.article.update' },
      { action: 'api::article.article.delete' },
      { action: 'api::article.article.incrementView' },
      { action: 'api::article.article.submit' },
      { action: 'api::tag.tag.find' },
      { action: 'api::tag.tag.findOne' },
      { action: 'api::tag.tag.create' },
      { action: 'api::comment.comment.find' },
      { action: 'api::comment.comment.findOne' },
      { action: 'api::comment.comment.create' },
      { action: 'api::comment.comment.update' },
      { action: 'api::comment.comment.delete' },
      { action: 'api::comment.comment.toggleLike' },
      { action: 'api::reaction.reaction.find' },
      { action: 'api::reaction.reaction.create' },
      { action: 'api::reaction.reaction.delete' },
      { action: 'api::subscription.subscription.find' },
      { action: 'api::subscription.subscription.create' },
      { action: 'api::subscription.subscription.update' },
      { action: 'api::subscription.subscription.delete' },
      { action: 'api::blogger.blogger.dashboard' },
      { action: 'api::blogger.blogger.analytics' },
      { action: 'plugin::users-permissions.user.me' },
      { action: 'api::auth-custom.auth-custom.me' },
      { action: 'api::auth-custom.auth-custom.mentionSearch' },
      { action: 'api::auth-custom.auth-custom.publicProfile' },
      { action: 'api::auth-custom.auth-custom.updateMe' },
      { action: 'api::auth-custom.auth-custom.upgradeToBlogger' },
      { action: 'api::notification.notification.me' },
      { action: 'api::notification.notification.markRead' },
      { action: 'api::notification.notification.markAllRead' },
      { action: 'api::notification.notification.removeOne' },
      { action: 'api::notification.notification.clearAll' },
      { action: 'api::notification.notification.sendTest' },
      { action: 'plugin::upload.content-api.upload' },
    ],
    // ── Admin ─────────────────────────────────────────────────────────────
    admin: [
      { action: 'api::article.article.find' },
      { action: 'api::article.article.findOne' },
      { action: 'api::article.article.create' },
      { action: 'api::article.article.update' },
      { action: 'api::article.article.delete' },
      { action: 'api::article.article.incrementView' },
      { action: 'api::article.article.findPending' },
      { action: 'api::article.article.approve' },
      { action: 'api::article.article.reject' },
      { action: 'api::article.article.submit' },
      { action: 'api::tag.tag.find' },
      { action: 'api::tag.tag.findOne' },
      { action: 'api::tag.tag.create' },
      { action: 'api::tag.tag.update' },
      { action: 'api::tag.tag.delete' },
      { action: 'api::comment.comment.find' },
      { action: 'api::comment.comment.findOne' },
      { action: 'api::comment.comment.create' },
      { action: 'api::comment.comment.update' },
      { action: 'api::comment.comment.delete' },
      { action: 'api::comment.comment.toggleLike' },
      { action: 'api::reaction.reaction.find' },
      { action: 'api::reaction.reaction.create' },
      { action: 'api::reaction.reaction.delete' },
      { action: 'api::subscription.subscription.find' },
      { action: 'api::subscription.subscription.create' },
      { action: 'api::subscription.subscription.update' },
      { action: 'api::subscription.subscription.delete' },
      { action: 'api::admin-panel.admin-panel.dashboard' },
      { action: 'api::admin-panel.admin-panel.createBlogger' },
      { action: 'api::admin-panel.admin-panel.listUsers' },
      { action: 'api::admin-panel.admin-panel.blockUser' },
      { action: 'api::admin-panel.admin-panel.unblockUser' },
      { action: 'api::admin-panel.admin-panel.setUserRole' },
      { action: 'api::admin-panel.admin-panel.listArticles' },
      { action: 'api::admin-panel.admin-panel.unpublishArticle' },
      { action: 'api::admin-panel.admin-panel.deleteArticle' },
      { action: 'api::admin-panel.admin-panel.listComments' },
      { action: 'api::admin-panel.admin-panel.deleteComment' },
      { action: 'api::blogger.blogger.dashboard' },
      { action: 'api::blogger.blogger.analytics' },
      { action: 'plugin::users-permissions.user.me' },
      { action: 'plugin::users-permissions.user.find' },
      { action: 'plugin::users-permissions.user.findOne' },
      { action: 'plugin::users-permissions.user.update' },
      { action: 'api::auth-custom.auth-custom.me' },
      { action: 'api::auth-custom.auth-custom.mentionSearch' },
      { action: 'api::auth-custom.auth-custom.publicProfile' },
      { action: 'api::auth-custom.auth-custom.updateMe' },
      { action: 'api::auth-custom.auth-custom.upgradeToBlogger' },
      { action: 'api::notification.notification.me' },
      { action: 'api::notification.notification.markRead' },
      { action: 'api::notification.notification.markAllRead' },
      { action: 'api::notification.notification.removeOne' },
      { action: 'api::notification.notification.clearAll' },
      { action: 'api::notification.notification.sendTest' },
      { action: 'plugin::upload.content-api.upload' },
      { action: 'api::announcement.announcement.find' },
      { action: 'api::announcement.announcement.findOne' },
      { action: 'api::announcement.announcement.create' },
      { action: 'api::announcement.announcement.update' },
      { action: 'api::announcement.announcement.delete' },
      { action: 'api::announcement.announcement.active' },
      { action: 'api::newsletter-signup.newsletter-signup.find' },
      { action: 'api::newsletter-signup.newsletter-signup.findOne' },
      { action: 'api::newsletter-signup.newsletter-signup.delete' },
      { action: 'api::newsletter-signup.newsletter-signup.subscribe' },
    ],
  };

  // Fetch all roles at once
  const roles = await strapi.db
    .query('plugin::users-permissions.role')
    .findMany({ where: { type: { $in: ['public', 'authenticated', 'blogger', 'admin'] } } });

  const roleByType = Object.fromEntries(roles.map((r) => [r.type, r]));

  for (const [roleType, actions] of Object.entries(permMap)) {
    const role = roleByType[roleType];
    if (!role) {
      strapi.log.warn(`⚠️  Role '${roleType}' not found — skipping permissions`);
      continue;
    }

    for (const { action } of actions) {
      const existing = await strapi.db
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: role.id } });

      if (!existing) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action, role: role.id, enabled: true },
        });
      } else if (existing.enabled === false) {
        // Strapi's permission discovery may have inserted the row as disabled
        // before our seed ran the first time — force it enabled now.
        await strapi.db.query('plugin::users-permissions.permission').update({
          where: { id: existing.id },
          data: { enabled: true },
        });
      }
    }

    strapi.log.info(`✅ Permissions seeded for role: ${roleType}`);
  }
}
