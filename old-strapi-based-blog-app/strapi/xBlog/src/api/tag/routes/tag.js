'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::tag.tag', {
  config: {
    find: { middlewares: [] },
    findOne: { middlewares: [] },
    // Open to anyone with the `api::tag.tag.create` users-permission —
    // bloggers + admins. Drops the previous `global::is-admin` policy that
    // was overriding the new permission and causing "Policy Failed" when
    // the in-editor TagSelector tried to mint a tag.
    create: { policies: [] },
    // update/delete stay admin-only so bloggers can't rename or remove
    // tags other authors are using.
    update: { policies: ['global::is-admin'] },
    delete: { policies: ['global::is-admin'] },
  },
});
