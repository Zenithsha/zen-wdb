'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::article.article', {
  config: {
    find: {
      middlewares: [],
    },
    findOne: {
      middlewares: [],
    },
    create: {
      policies: ['global::is-blogger'],
    },
    update: {
      policies: ['global::is-owner'],
    },
    delete: {
      policies: ['global::is-owner'],
    },
  },
});
