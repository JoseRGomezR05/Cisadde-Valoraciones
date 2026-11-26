/* CISADDE · trabajador de la app instalable.
   Primero la red (siempre la versión más nueva); si no hay internet, la copia
   guardada. Así la app abre y se puede seguir valorando sin conexión. */
const CACHE = 'cisadde-v1';
const PAGINAS = ['./', 'Inicio%20CISADDE.html', 'Psicol%C3%B3gica%20JRG.html', 'Terapia%20Ocupacional%20JRG.html',
  'Integraci%C3%B3n%20Sensorial%20JRG.html', 'Fonoaudiologia%20JRG.html', 'Fisioterapia%20JRG.html',
  'Valoraci%C3%B3n%20de%20Taller%20JRG.html', 'manifest.webmanifest', 'iconos/icono-192.png', 'iconos/icono-512.png'];
const EXTERNOS = /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PAGINAS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const propio = u.origin === self.location.origin;
  if (!propio && !EXTERNOS.test(r.url)) return;
  // aviso.json y config.json siempre frescos (no se guardan)
  if (propio && /\/(aviso|config)\.json$/.test(u.pathname)) return;
  e.respondWith(fetch(r).then(resp => {
    if (resp && (resp.ok || resp.type === 'opaque')) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(r, copia)).catch(() => {}); }
    return resp;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('Inicio%20CISADDE.html') : undefined))));
});
