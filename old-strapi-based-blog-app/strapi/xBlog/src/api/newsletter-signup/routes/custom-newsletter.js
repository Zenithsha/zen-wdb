'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/newsletter/subscribe',
      handler: 'newsletter-signup.subscribe',
      config: { auth: false, policies: [] },
    },
  ],
};
