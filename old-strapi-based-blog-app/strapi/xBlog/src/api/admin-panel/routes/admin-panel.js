'use strict';

module.exports = {
  routes: [
    // ── Auth ────────────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/admin/login',
      handler: 'admin-panel.login',
      config: { auth: false, policies: [] },
    },

    // ── Overview ────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/admin/dashboard',
      handler: 'admin-panel.dashboard',
      config: { policies: ['global::is-admin'] },
    },

    // ── Users ───────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/admin/users',
      handler: 'admin-panel.listUsers',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/blogger',
      handler: 'admin-panel.createBlogger',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/:id/block',
      handler: 'admin-panel.blockUser',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/:id/unblock',
      handler: 'admin-panel.unblockUser',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/users/:id/role',
      handler: 'admin-panel.setUserRole',
      config: { policies: ['global::is-admin'] },
    },

    // ── Articles ────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/admin/articles',
      handler: 'admin-panel.listArticles',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'POST',
      path: '/admin/articles/:id/unpublish',
      handler: 'admin-panel.unpublishArticle',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'DELETE',
      path: '/admin/articles/:id',
      handler: 'admin-panel.deleteArticle',
      config: { policies: ['global::is-admin'] },
    },

    // ── Comments ────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/admin/comments',
      handler: 'admin-panel.listComments',
      config: { policies: ['global::is-admin'] },
    },
    {
      method: 'DELETE',
      path: '/admin/comments/:id',
      handler: 'admin-panel.deleteComment',
      config: { policies: ['global::is-admin'] },
    },
  ],
};
