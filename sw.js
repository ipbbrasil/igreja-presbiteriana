// Service worker: guarda só os arquivos do app (nunca os dados) para abrir rápido.
const VERSAO = 'painel-v31';
const ARQUIVOS = [
  './', 'index.html', 'css/app.css', 'js/config.js', 'js/regras.js', 'js/data.js', 'js/mapa-brasil.js', 'js/charts.js', 'js/dicionario.js', 'js/leitura.js', 'js/envio.js', 'js/resumo.js', 'js/exportar.js', 'js/ajuda.js', 'js/privacidade.js', 'js/app.js',
  'manifest.webmanifest', 'icons/logo_ipb.png', 'icons/favicon.png', 'icons/icon-192.png',
];

// Instala a versão nova buscando os arquivos direto do servidor (sem usar cópias antigas do navegador)
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Programa: responde na hora com a cópia do aparelho e atualiza em segundo plano (abre rápido mesmo
// com internet lenta). Quando sai uma versão nova, ela vale a partir da próxima abertura do app.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/dados/')) return;
  e.respondWith(caches.open(VERSAO).then(async (c) => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    const daRede = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (guardado) { e.waitUntil(daRede); return guardado; }
    return (await daRede) || (await c.match('index.html')) || Response.error();
  }));
});
