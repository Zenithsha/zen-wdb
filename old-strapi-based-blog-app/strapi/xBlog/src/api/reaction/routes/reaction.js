'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::reaction.reaction', {
  config: {
    find: { middlewares: [] },
    findOne: { middlewares: [] },
    create: { middlewares: [] },
    delete: { policies: ['global::is-owner'] },
  },
});
