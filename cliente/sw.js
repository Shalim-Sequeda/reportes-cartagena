// service worker para reportes ciudadanos cartagena (pwa)
const CACHE_NAME = 'reportes-ctg-v10';
const ASSETS_ESTATICOS = [
  '/',
  '/index.html',
  '/css/estilos.css',
  '/js/app.js',
  '/js/ClienteApi.js',
  '/js/seguridad.js',
  '/img/icon.svg',
  '/manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_ESTATICOS).catch((err) => {
        console.warn('Algunos recursos externos no se precacharon:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // peticiones de api van siempre a la red (network-first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            codigo: 503,
            mensaje: 'Sin conexión a internet. Verifique su red móvil.'
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // recursos estáticos: network-first con fallback a cache para soporte sin conexión
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// soporte de notificaciones push nativas
self.addEventListener('push', (event) => {
  let payload = { titulo: 'Alerta de Servicios Cartagena', cuerpo: 'Se ha registrado una incidencia en tu sector.' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.cuerpo = event.data.text();
    }
  }

  const opciones = {
    body: payload.cuerpo,
    icon: '/img/icon.svg',
    badge: '/img/icon.svg',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(payload.titulo, opciones)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
