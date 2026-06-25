/* Service worker de FCM (push en background) + fetch handler (habilita instalar la PWA). */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAht9yleWzCXNjdC6ISK1IxWiCxKvZDIQI',
  authDomain: 'taskapp-b9359.firebaseapp.com',
  projectId: 'taskapp-b9359',
  storageBucket: 'taskapp-b9359.firebasestorage.app',
  messagingSenderId: '556175254248',
  appId: '1:556175254248:web:6b0c62bb8b12f7ef809f5d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || data.title || 'DTOS', {
    body: n.body || data.body || '',
    icon: '/img/logo.png',
    badge: '/favicon-48x48.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate && c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Fetch handler mínimo: criterio de instalabilidad de la PWA (no cachea nada).
self.addEventListener('fetch', () => {});
