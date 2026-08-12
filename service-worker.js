/* =========================================================
   service-worker.js — cache do app shell para uso offline
   ========================================================= */
const VERSAO = "estudo-facil-v1";
const CACHE_SHELL = VERSAO + "-shell";
const CACHE_RUNTIME = VERSAO + "-runtime";

const ARQUIVOS_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/db.js",
  "./js/textCleanup.js",
  "./js/speech.js",
  "./js/export.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon-180.png",
];

// URLs de bibliotecas externas (exportação). Ficam em cache
// separado e são atualizadas em segundo plano quando possível.
const ORIGENS_RUNTIME = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(ARQUIVOS_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave.startsWith("estudo-facil-") && chave !== CACHE_SHELL && chave !== CACHE_RUNTIME)
            .map((chave) => caches.delete(chave))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Bibliotecas externas: cache-first com atualização em segundo plano
  if (ORIGENS_RUNTIME.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_RUNTIME).then((cache) =>
        cache.match(req).then((cacheado) => {
          const buscaRede = fetch(req)
            .then((resp) => {
              if (resp && resp.status === 200) cache.put(req, resp.clone());
              return resp;
            })
            .catch(() => cacheado);
          return cacheado || buscaRede;
        })
      )
    );
    return;
  }

  // App shell (mesma origem): cache-first, com fallback de rede
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cacheado) => {
        if (cacheado) return cacheado;
        return fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const clone = resp.clone();
              caches.open(CACHE_SHELL).then((cache) => cache.put(req, clone));
            }
            return resp;
          })
          .catch(() => {
            if (req.mode === "navigate") return caches.match("./index.html");
          });
      })
    );
  }
});
