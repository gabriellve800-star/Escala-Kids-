// Escala Kids — PWA. Atualização com confirmação do usuário para evitar perda de formulários.
// Ao publicar uma versão nova, altere este identificador para substituir o cache anterior.
const CACHE = 'escala-kids-v1.2.3-qa-invite-fix';
const ASSETS = ['./','./index.html','./styles.css','./app.js?v=1.2.3','./config.js','./qrcode.min.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Não ativar forçadamente: a pessoa confirma após ver "Nova versão disponível".
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('escala-kids-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Nunca armazenar chamadas externas, Auth, dados da equipe ou crianças.
  if (url.origin !== self.location.origin || !allowed.has(url.href)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});