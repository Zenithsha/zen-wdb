'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/blogger/dashboard',
      handler: 'blogger.dashboard',
      config: {
        policies: ['global::is-blogger'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/blogger/analytics',
      handler: 'blogger.analytics',
      config: {
        policies: ['global::is-blogger'],
        middlewares: [],
      },
    },
  ],
};
