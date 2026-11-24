// Service worker para reportes ciudadanos Cartagena (PWA)
const CACHE_NAME = 'reportes-ctg-v10';
const TILE_CACHE_NAME = 'reportes-ctg-tiles-v1';
const ASSETS_ESTATICOS = [
  '/',
  '/index.html',
  '/css/estilos.css',
  '/js/app.js',
  '/js/ClienteApi.js',
  '/lib/leaflet.css',
  '/lib/leaflet.js',
  '/lib/leaflet-heat.js',
  '/img/icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_ESTATICOS).catch((err) => {
        console.warn('Algunos recursos locales no se precacharon:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Peticiones de API van siempre a la red (network-first)
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

  // 2. Teselas de mapas: cache-first para carga instantánea y navegación fluida sin cuadros grises
  if (url.hostname.includes('arcgisonline.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (tileCache) => {
        const coincidencia = await tileCache.match(event.request);
        if (coincidencia) {
          return coincidencia;
        }
        try {
          const respuestaRed = await fetch(event.request, { mode: 'cors' });
          if (respuestaRed && respuestaRed.status === 200) {
            tileCache.put(event.request, respuestaRed.clone());
          }
          return respuestaRed;
        } catch {
          return coincidencia || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 3. Recursos estáticos locales: stale-while-revalidate para velocidad máxima
  event.respondWith(
    caches.match(event.request).then((recursoEnCache) => {
      const peticionRed = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => recursoEnCache);

      return recursoEnCache || peticionRed;
    })
  );
});

// Soporte de notificaciones push nativas
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
