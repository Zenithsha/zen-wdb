'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

// Admin-only CRUD for the signup list (so admins can view/export emails in
// Strapi's Content Manager). The public-facing subscribe action lives in
// `custom-newsletter.js`.
module.exports = createCoreRouter('api::newsletter-signup.newsletter-signup', {
  config: {
    find: { policies: ['global::is-admin'] },
    findOne: { policies: ['global::is-admin'] },
    create: { policies: ['global::is-admin'] },
    update: { policies: ['global::is-admin'] },
    delete: { policies: ['global::is-admin'] },
  },
});
