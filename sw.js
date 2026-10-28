/* ============================================================
   Planejamento em Mãos — service worker (funcionamento offline)

   • O app (index.html) é buscado na internet primeiro, para sempre
     pegar a versão nova; sem internet, abre a última versão salva.
   • Firebase (scripts), fontes, logo e ícones ficam guardados no
     aparelho e são atualizados em segundo plano.
   • Fotos e gráficos já vistos ficam guardados para abrir sem internet.
   • Os DADOS (frentes, programação, cronograma…) NÃO passam por aqui:
     quem guarda é o próprio Firestore no aparelho (enablePersistence).

   Para forçar todo mundo a baixar tudo de novo, troque a VERSAO.
   ============================================================ */
const VERSAO = 'pm-v1';
const CACHE_APP = `${VERSAO}-app`;
const CACHE_EXTRA = `${VERSAO}-extra`;

const ARQUIVOS_APP = ['./', './index.html', './manifest.json'];
const ARQUIVOS_EXTERNOS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check-compat.js',
  'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
];

// endereços que nunca devem ser guardados (login, banco de dados, vídeos)
const NUNCA = [/firestore\.googleapis\.com/, /identitytoolkit\.googleapis\.com/, /securetoken\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/, /recaptcha/, /google-analytics|googletagmanager/, /\.(mp4|webm|mov)(\?|$)/i];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    await Promise.all(ARQUIVOS_APP.map(u => app.add(u).catch(() => {})));
    const extra = await caches.open(CACHE_EXTRA);
    await Promise.all(ARQUIVOS_EXTERNOS.map(u => fetch(u, { mode: 'no-cors' }).then(r => extra.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => !n.startsWith(VERSAO)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// internet primeiro (com limite de tempo); sem resposta, usa o guardado
async function redePrimeiro(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resp = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('demorou')), 6000)),
    ]);
    if (resp && resp.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, resp.clone());
    return resp;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

// usa o guardado na hora e atualiza em segundo plano
async function guardadoEAtualiza(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardado = await cache.match(req);
  const daRede = fetch(req).then(resp => {
    if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
    return resp;
  }).catch(() => null);
  return guardado || (await daRede) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;
  const url = req.url;
  if (NUNCA.some(r => r.test(url))) return;

  const mesmoSite = new URL(url).origin === self.location.origin;
  if (req.mode === 'navigate' || (mesmoSite && /\/(index\.html)?$/.test(new URL(url).pathname))) {
    event.respondWith(redePrimeiro(req));
    return;
  }
  if (mesmoSite) {
    event.respondWith(guardadoEAtualiza(req, CACHE_APP));
    return;
  }
  // scripts do Firebase, fontes, logo/ícones externos, fotos e gráficos do Drive
  if (/gstatic\.com|googleapis\.com\/css|fonts\.gstatic\.com|imgur\.com|googleusercontent\.com|drive\.google\.com|cdnjs\.cloudflare\.com/.test(url)) {
    event.respondWith(guardadoEAtualiza(req, CACHE_EXTRA));
  }
});
