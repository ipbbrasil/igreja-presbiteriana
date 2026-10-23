// Service worker: guarda só os arquivos do app (nunca os dados) para abrir rápido.
const VERSAO = 'painel-v17';
const ARQUIVOS = [
  './', 'index.html', 'css/app.css', 'js/config.js', 'js/regras.js', 'js/data.js', 'js/charts.js', 'js/dicionario.js', 'js/leitura.js', 'js/envio.js', 'js/exportar.js', 'js/ajuda.js', 'js/privacidade.js', 'js/app.js',
  'manifest.webmanifest', 'icons/logo_ipb.png', 'icons/favicon.png', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Rede primeiro (atualizações aparecem logo); cache só como reserva offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/dados/')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
