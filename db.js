/* =========================================================
   db.js — camada de armazenamento local (IndexedDB)
   Guarda os textos da aluna no próprio iPhone/navegador.
   Nada sai do dispositivo: sem backend, sem serviços pagos.
   ========================================================= */
(function (global) {
  "use strict";

  const DB_NAME = "estudoFacilDB";
  const DB_VERSION = 1;
  const STORE = "documentos";

  let dbPromise = null;

  function abrirDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in global)) {
        reject(new Error("IndexedDB não suportado neste navegador."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("atualizadoEm", "atualizadoEm", { unique: false });
          store.createIndex("tema", "tema", { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  function gerarId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function contarPalavras(texto) {
    const t = (texto || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }

  async function salvarDocumento(doc) {
    const db = await abrirDB();
    const agora = new Date().toISOString();
    const registro = {
      id: doc.id || gerarId(),
      titulo: (doc.titulo || "Sem título").trim() || "Sem título",
      conteudo: doc.conteudo || "",
      tema: doc.tema || "",
      criadoEm: doc.criadoEm || agora,
      atualizadoEm: agora,
      palavras: contarPalavras(doc.conteudo || ""),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(registro);
      tx.oncomplete = () => resolve(registro);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async function listarDocumentos() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const lista = req.result || [];
        lista.sort((a, b) => (b.atualizadoEm || "").localeCompare(a.atualizadoEm || ""));
        resolve(lista);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function obterDocumento(id) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function excluirDocumento(id) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  global.EstudoFacilDB = {
    salvarDocumento,
    listarDocumentos,
    obterDocumento,
    excluirDocumento,
    contarPalavras,
    gerarId,
  };
})(window);
