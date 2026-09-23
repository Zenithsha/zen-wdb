'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Small helper module-scoped function used by other controllers (comment,
 * reaction, article) to drop a notification onto a user's row. Skips if
 * recipient === actor (don't notify yourself about your own action).
 */
async function createNotification(strapi, { type, title, message, link, recipientId, actorId }) {
  if (!recipientId) return null;
  if (recipientId === actorId) return null;
  try {
    return await strapi.documents('api::notification.notification').create({
      data: {
        type,
        title: String(title).slice(0, 200),
        message: message ? String(message).slice(0, 500) : null,
        link: link || null,
        read: false,
        recipient: recipientId,
        ...(actorId ? { actor: actorId } : {}),
      },
    });
  } catch (err) {
    strapi.log.warn(`[notification] failed to create: ${err.message}`);
    return null;
  }
}

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  /**
   * GET /notifications/me
   * Returns the current user's notifications, newest first, with the
   * unread count up front.
   */
  async me(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const userId = ctx.state.user.id;

    const list = await strapi.db.query('api::notification.notification').findMany({
      where: { recipient: { id: userId } },
      orderBy: { createdAt: 'desc' },
      limit: 100,
      populate: { actor: { select: ['id', 'username', 'displayName'], populate: { profilePicture: { select: ['url'] } } } },
    });

    const unread = list.filter((n) => !n.read).length;

    const data = list.map((n) => ({
      id: n.id,
      documentId: n.documentId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      read: !!n.read,
      createdAt: n.createdAt,
      actor: n.actor
        ? {
            id: n.actor.id,
            username: n.actor.username,
            displayName: n.actor.displayName || n.actor.username,
            profilePicture: n.actor.profilePicture ? { url: n.actor.profilePicture.url } : null,
          }
        : null,
    }));

    return ctx.send({ data, meta: { unread } });
  },

  /**
   * POST /notifications/:id/read
   * Marks a single notification as read. Must belong to the caller.
   */
  async markRead(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const { id } = ctx.params;
    const userId = ctx.state.user.id;

    const row = await strapi.db.query('api::notification.notification').findOne({
      where: { documentId: id },
      populate: ['recipient'],
    });
    if (!row) return ctx.notFound();
    if (!row.recipient || row.recipient.id !== userId) return ctx.forbidden();

    await strapi.db.query('api::notification.notification').update({
      where: { id: row.id },
      data: { read: true },
    });
    return ctx.send({ data: { documentId: id, read: true } });
  },

  /**
   * POST /notifications/read-all
   * Marks every unread notification for the caller as read.
   *
   * `strapi.db.query(...).updateMany` exists in Strapi v5 but its
   * behaviour around the `where` shape with nested relations is
   * version-dependent and was failing here. Loop over the unread
   * rows individually — slower but bulletproof across versions, and
   * each user typically only has a handful of unreads anyway.
   */
  async markAllRead(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const userId = ctx.state.user.id;
    try {
      const rows = await strapi.db.query('api::notification.notification').findMany({
        where: { recipient: { id: userId }, read: false },
        select: ['id'],
        limit: 1000,
      });
      for (const r of rows) {
        await strapi.db.query('api::notification.notification').update({
          where: { id: r.id },
          data: { read: true },
        });
      }
      return ctx.send({ data: { ok: true, updated: rows.length } });
    } catch (err) {
      strapi.log.error(`[notification.markAllRead] ${err.message}`);
      return ctx.internalServerError('Failed to mark notifications as read');
    }
  },

  /**
   * DELETE /notifications/:id
   * Removes a notification permanently. Must belong to the caller.
   */
  async removeOne(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const { id } = ctx.params;
    const userId = ctx.state.user.id;
    const row = await strapi.db.query('api::notification.notification').findOne({
      where: { documentId: id },
      populate: ['recipient'],
    });
    if (!row) return ctx.notFound();
    if (!row.recipient || row.recipient.id !== userId) return ctx.forbidden();
    await strapi.documents('api::notification.notification').delete({ documentId: id });
    return ctx.send({ data: { documentId: id, deleted: true } });
  },

  /**
   * POST /notifications/test
   * Dev / smoke-test helper — creates a notification addressed to the
   * caller. Real notifications never fire from your own actions (you
   * can't notify yourself), so this gives you a way to verify the
   * front-end bell + toast wiring without a second account.
   */
  async sendTest(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const userId = ctx.state.user.id;
    const created = await strapi.documents('api::notification.notification').create({
      data: {
        type: 'announcement',
        title: `🔔 Test notification for ${ctx.state.user.displayName || ctx.state.user.username}`,
        message: 'This is a self-issued test notification — real notifications fire when OTHER users interact with your content.',
        link: '/notifications',
        read: false,
        recipient: userId,
      },
    });
    return ctx.send({ data: created });
  },

  /**
   * DELETE /notifications/all
   * Clears every notification belonging to the caller.
   */
  async clearAll(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const userId = ctx.state.user.id;
    const rows = await strapi.db.query('api::notification.notification').findMany({
      where: { recipient: { id: userId } },
      select: ['id'],
      limit: 1000,
    });
    for (const r of rows) {
      await strapi.db.query('api::notification.notification').delete({ where: { id: r.id } });
    }
    return ctx.send({ data: { ok: true, removed: rows.length } });
  },
}));

// Export the helper for use from other controllers via require(...).
module.exports.createNotification = createNotification;
