'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/announcements/active',
      handler: 'announcement.active',
      config: { auth: false, policies: [] },
    },
  ],
};
