// Σκύλλα service worker — ONLY shows push notifications (2026-09-25).
// Deliberately has no fetch handler: the site is never cached or served
// from here, so this can't ever show a stale page.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Σκύλλα', {
    body: d.body || '',
    icon: d.icon || '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/static' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/static';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if ('focus' in c) { if ('navigate' in c) c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
