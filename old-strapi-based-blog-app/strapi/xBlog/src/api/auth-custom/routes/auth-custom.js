'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/register-public',
      handler: 'auth-custom.registerPublic',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth-custom.me',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/mention-search',
      handler: 'auth-custom.mentionSearch',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/profile/:username',
      handler: 'auth-custom.publicProfile',
      config: { auth: false, policies: [] },
    },
    // Both PUT and PATCH map to the same updateMe handler. PUT is the most
    // broadly compatible across proxies / older browsers; PATCH stays as
    // a courtesy for clients that prefer it semantically.
    {
      method: 'PUT',
      path: '/auth/me',
      handler: 'auth-custom.updateMe',
      config: { policies: [] },
    },
    {
      method: 'PATCH',
      path: '/auth/me',
      handler: 'auth-custom.updateMe',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/auth/upgrade-to-blogger',
      handler: 'auth-custom.upgradeToBlogger',
      config: { policies: [] },
    },
  ],
};
