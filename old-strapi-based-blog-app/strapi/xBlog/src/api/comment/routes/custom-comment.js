'use strict';

/**
 * Custom comment routes (non-core).
 * Core CRUD still lives in ./comment.js.
 */
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/comments/:documentId/toggle-like',
      handler: 'comment.toggleLike',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
