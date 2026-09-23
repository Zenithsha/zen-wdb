'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::subscription.subscription', ({ strapi }) => ({
  async create(ctx) {
    // Force the subscription's user to be the authenticated user
    ctx.request.body.data = { ...ctx.request.body.data, user: ctx.state.user.id };
    return super.create(ctx);
  },
}));
