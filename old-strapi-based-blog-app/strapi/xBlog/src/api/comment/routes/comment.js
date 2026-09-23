'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::comment.comment', {
  config: {
    find: { middlewares: [] },
    findOne: { middlewares: [] },
    create: { middlewares: [] },
    update: { policies: ['global::is-owner'] },
    delete: { policies: ['global::is-owner'] },
  },
});
