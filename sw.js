// Service worker mínimo — só existe pra habilitar a instalação do app
// no celular (é um requisito técnico dos navegadores). Não guarda nada
// em cache de propósito, porque esse app depende de dados sempre
// atualizados do Firestore — cachear poderia mostrar informação velha.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
