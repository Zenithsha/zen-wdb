'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/articles/pending',
      handler: 'article.findPending',
      config: {
        policies: ['global::is-admin'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/approve',
      handler: 'article.approve',
      config: {
        policies: ['global::is-admin'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/reject',
      handler: 'article.reject',
      config: {
        policies: ['global::is-admin'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/submit',
      handler: 'article.submit',
      config: {
        policies: ['global::is-owner'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/articles/:id/increment-view',
      handler: 'article.incrementView',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
