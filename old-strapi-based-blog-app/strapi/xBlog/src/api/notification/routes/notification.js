'use strict';

// No core router for notifications — they're created internally only,
// and read/marked-read by their owner via the custom routes below.
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications/me',
      handler: 'notification.me',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/notifications/:id/read',
      handler: 'notification.markRead',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/notifications/read-all',
      handler: 'notification.markAllRead',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/notifications/test',
      handler: 'notification.sendTest',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/notifications/all',
      handler: 'notification.clearAll',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/notifications/:id',
      handler: 'notification.removeOne',
      config: { policies: [] },
    },
  ],
};
