'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::announcement.announcement', ({ strapi }) => ({
  /**
   * GET /api/announcements/active
   * Public — returns the most recently created active announcement, or null.
   * The homepage hero calls this; if `data` is null it falls back to a
   * rotating motivational quote on the client.
   */
  async active(ctx) {
    const list = await strapi.documents('api::announcement.announcement').findMany({
      filters: { isActive: true },
      sort: { createdAt: 'desc' },
      limit: 1,
    });
    return ctx.send({ data: list[0] || null });
  },
}));
