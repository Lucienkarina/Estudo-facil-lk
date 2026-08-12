/* =========================================================
   app.js — controlador principal do Estudo Fácil
   ========================================================= */
(function () {
  "use strict";

  const DB = window.EstudoFacilDB;
  const Texto = window.EstudoFacilTexto;
  const Exportar = window.EstudoFacilExport;

  // ---------------- Conteúdo: Estudos de História ----------------
  const TECNICAS = [
    { titulo: "Linha do tempo", texto: "Fale os acontecimentos em ordem cronológica, um de cada vez. Diga a data, o fato e uma causa ou consequência. Isso ajuda a fixar a sequência e enxergar relações entre os eventos." },
    { titulo: "Mapa mental falado", texto: "Escolha um tema central e vá falando os ramos: causas, personagens, datas, consequências. Depois releia o texto gerado e organize em tópicos com marcadores." },
    { titulo: "Ficha-resumo", texto: "Ao final de um assunto, grave um resumo curto como se estivesse explicando para um colega: o que aconteceu, quando, onde, por quê e o que mudou depois." },
    { titulo: "Técnica Feynman", texto: "Explique o assunto em voz alta com suas próprias palavras, como se ensinasse para alguém que não sabe nada sobre o tema. Se travar em algum ponto, é sinal de que precisa estudar mais aquela parte." },
    { titulo: "Revisão espaçada", texto: "Volte aos textos salvos em 📂 Meus arquivos depois de 1 dia, 1 semana e 1 mês. Regravar o mesmo tema com suas palavras de novo ajuda a fixar melhor do que reler." },
    { titulo: "Comparar versões", texto: "Fale sobre o mesmo tema em dois momentos diferentes e compare os dois textos depois. Você vai perceber o que aprendeu de novo entre uma vez e outra." },
  ];

  const TEMAS = [
    "Pré-História", "Antiguidade Oriental", "Grécia Antiga", "Roma Antiga",
    "Idade Média", "Grandes Navegações", "Idade Moderna", "Brasil Colônia",
    "Iluminismo", "Revolução Francesa", "Revolução Industrial",
    "Independência do Brasil", "Brasil Império", "Proclamação da República",
    "Primeira Guerra Mundial", "Revolução Russa", "Segunda Guerra Mundial",
    "Era Vargas", "Guerra Fria", "Ditadura Militar no Brasil",
    "Redemocratização", "Brasil Contemporâneo",
  ];

  // ---------------- Estado ----------------
  const state = {
    view: "editor",
    doc: docEmBranco(),
    dirty: false,
    speechProvider: null,
    ouvindo: false,
    saveTimer: null,
    interimBase: "", // texto salvo antes do trecho parcial atual
  };

  function docEmBranco(tema) {
    return {
      id: null,
      titulo: tema || "",
      conteudo: "",
      tema: tema || "",
      criadoEm: null,
      atualizadoEm: null,
    };
  }

  // ---------------- Referências DOM ----------------
  const el = {
    main: document.getElementById("main"),
    views: Array.from(document.querySelectorAll(".view")),
    tabs: Array.from(document.querySelectorAll(".tab")),
    statusDot: document.getElementById("status-dot"),

    tituloInput: document.getElementById("doc-titulo"),
    temaChip: document.getElementById("doc-tema-chip"),
    micBtn: document.getElementById("btn-mic"),
    micStatus: document.getElementById("mic-status"),
    transcript: document.getElementById("transcript"),
    wordCount: document.getElementById("word-count"),
    saveIndicator: document.getElementById("save-indicator"),
    btnLimpar: document.getElementById("btn-limpar"),
    btnSalvar: document.getElementById("btn-salvar"),
    btnExportar: document.getElementById("btn-exportar"),
    exportMenu: document.getElementById("export-menu"),
    btnShareEditor: document.getElementById("btn-share-editor"),

    listaTecnicas: document.getElementById("lista-tecnicas"),
    listaTemas: document.getElementById("lista-temas"),

    buscaArquivos: document.getElementById("busca-arquivos"),
    listaArquivos: document.getElementById("lista-arquivos"),
    arquivosVazio: document.getElementById("arquivos-vazio"),

    listaCompartilhar: document.getElementById("lista-compartilhar"),
    compartilharVazio: document.getElementById("compartilhar-vazio"),

    toast: document.getElementById("toast"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalMsg: document.getElementById("modal-msg"),
    modalActions: document.getElementById("modal-actions"),

    tabFalar: document.querySelector('.tab[data-nav="falar"]'),
  };

  // ---------------- Utilidades de UI ----------------
  let toastTimer = null;
  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add("hidden"), ms || 2200);
  }

  function fecharModal() {
    el.modalBackdrop.classList.add("hidden");
    el.modalActions.innerHTML = "";
  }

  function abrirModal(msg, botoes) {
    el.modalMsg.textContent = msg;
    el.modalActions.innerHTML = "";
    botoes.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "tbtn " + (b.classe || "tbtn--ghost");
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        fecharModal();
        if (b.onClick) b.onClick();
      });
      el.modalActions.appendChild(btn);
    });
    el.modalBackdrop.classList.remove("hidden");
  }

  el.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === el.modalBackdrop) fecharModal();
  });

  function formatarHora(iso) {
    try {
      return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function formatarDataCurta(iso) {
    try {
      const d = new Date(iso);
      const hoje = new Date();
      const mesmoDia = d.toDateString() === hoje.toDateString();
      if (mesmoDia) return "Hoje, " + formatarHora(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch (e) {
      return "";
    }
  }

  // ---------------- Navegação entre telas ----------------
  function mostrarView(nome) {
    state.view = nome;
    el.views.forEach((v) => v.classList.toggle("hidden", v.dataset.view !== nome));
    el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.nav === nome || (nome === "editor" && t.dataset.nav === "falar")));
    if (nome === "arquivos") renderArquivos();
    if (nome === "compartilhar") renderCompartilhar();
    if (nome === "estudos" && !el.listaTecnicas.childElementCount) renderEstudos();
    window.scrollTo(0, 0);
  }

  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const nav = tab.dataset.nav;
      if (nav === "novo") {
        iniciarNovoDoc();
        mostrarView("editor");
        setTimeout(() => el.tituloInput.focus(), 150);
      } else if (nav === "falar") {
        if (state.view === "editor") {
          alternarMic();
        } else {
          iniciarNovoDoc();
          mostrarView("editor");
          setTimeout(() => iniciarMic(), 250);
        }
      } else {
        mostrarView(nav === "estudos" ? "estudos" : nav);
      }
    });
  });

  // ---------------- Editor: estado do documento ----------------
  function carregarDocNoEditor(doc) {
    state.doc = doc;
    el.tituloInput.value = doc.titulo || "";
    el.transcript.value = doc.conteudo || "";
    if (doc.tema) {
      el.temaChip.textContent = doc.tema;
      el.temaChip.classList.remove("hidden");
    } else {
      el.temaChip.classList.add("hidden");
    }
    atualizarContagem();
    el.saveIndicator.textContent = doc.atualizadoEm ? "Salvo às " + formatarHora(doc.atualizadoEm) : "";
    state.dirty = false;
  }

  function iniciarNovoDoc(tema) {
    pararMic();
    carregarDocNoEditor(docEmBranco(tema));
  }

  function atualizarContagem() {
    const n = Texto.contarPalavras(el.transcript.value);
    el.wordCount.textContent = n === 1 ? "1 palavra" : n + " palavras";
  }

  function marcarSujo() {
    state.dirty = true;
    el.saveIndicator.textContent = "";
    agendarAutoSave();
  }

  function agendarAutoSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(salvarSilencioso, 1200);
  }

  async function salvarSilencioso() {
    if (!el.tituloInput.value.trim() && !el.transcript.value.trim()) return;
    await persistirDocAtual();
  }

  async function persistirDocAtual() {
    state.doc.titulo = el.tituloInput.value;
    state.doc.conteudo = el.transcript.value;
    const salvo = await DB.salvarDocumento(state.doc);
    state.doc = salvo;
    state.dirty = false;
    el.saveIndicator.textContent = "Salvo às " + formatarHora(salvo.atualizadoEm);
    return salvo;
  }

  el.tituloInput.addEventListener("input", marcarSujo);
  el.transcript.addEventListener("input", () => {
    // Sincroniza a base usada pelo ditado, para não perder edições
    // manuais feitas enquanto o microfone ainda está ativo.
    state.interimBase = el.transcript.value;
    atualizarContagem();
    marcarSujo();
  });

  el.btnSalvar.addEventListener("click", async () => {
    if (!el.tituloInput.value.trim() && !el.transcript.value.trim()) {
      toast("Escreva ou fale algo antes de salvar.");
      return;
    }
    await persistirDocAtual();
    toast("Texto salvo em Meus arquivos.");
  });

  el.btnLimpar.addEventListener("click", () => {
    if (!el.transcript.value.trim() && !el.tituloInput.value.trim()) return;
    abrirModal("Limpar o título e o texto deste documento? Isso não apaga cópias já salvas.", [
      { label: "Cancelar", classe: "tbtn--ghost" },
      {
        label: "Limpar",
        classe: "tbtn--primary",
        onClick: () => {
          pararMic();
          iniciarNovoDoc();
        },
      },
    ]);
  });

  // ---------------- Microfone / ditado ----------------
  function setStatusDot(estado) {
    el.statusDot.classList.remove("offline", "recording");
    if (estado === "recording") el.statusDot.classList.add("recording");
    else if (!navigator.onLine) el.statusDot.classList.add("offline");
  }

  function obterProvider() {
    if (!state.speechProvider) {
      state.speechProvider = window.EstudoFacilSpeech.getTranscriptionProvider({
        onStatus: (estado) => {
          if (estado === "ouvindo") {
            el.micStatus.textContent = "Ouvindo… fale naturalmente";
          } else if (estado === "parado") {
            el.micStatus.textContent = "Toque no microfone e fale naturalmente";
          } else if (estado === "processando") {
            el.micStatus.textContent = "Processando…";
          }
          setStatusDot(estado === "ouvindo" ? "recording" : "idle");
        },
        onInterim: (parcial) => {
          const base = state.interimBase;
          el.transcript.value = base ? base + (base.endsWith("\n") ? "" : " ") + parcial : parcial;
          atualizarContagem();
        },
        onFinalChunk: (trechoBruto, pausaMs) => {
          const trecho = Texto.limparTexto(trechoBruto);
          const novoTexto = Texto.anexarTrecho(state.interimBase, trecho, pausaMs);
          state.interimBase = novoTexto;
          el.transcript.value = novoTexto;
          atualizarContagem();
          marcarSujo();
          // mantém o cursor/scroll no fim
          el.transcript.scrollTop = el.transcript.scrollHeight;
        },
        onError: (msg) => {
          toast(msg);
        },
      });
    }
    return state.speechProvider;
  }

  function iniciarMic() {
    const provider = obterProvider();
    if (!provider.isSupported()) {
      abrirModal(
        "Este navegador não tem suporte ao ditado por voz. No iPhone, use o Safari mais recente e permita o microfone. Você também pode digitar seu texto normalmente.",
        [{ label: "Entendi", classe: "tbtn--primary" }]
      );
      return;
    }
    state.interimBase = el.transcript.value || "";
    state.ouvindo = true;
    el.micBtn.setAttribute("aria-pressed", "true");
    el.tabFalar.classList.add("recording");
    provider.start();
  }

  function pararMic() {
    if (!state.speechProvider) return;
    state.ouvindo = false;
    el.micBtn.setAttribute("aria-pressed", "false");
    el.tabFalar.classList.remove("recording");
    state.speechProvider.stop();
    setStatusDot("idle");
  }

  function alternarMic() {
    if (state.ouvindo) pararMic();
    else iniciarMic();
  }

  el.micBtn.addEventListener("click", alternarMic);

  // ---------------- Exportar / Compartilhar (editor) ----------------
  el.btnExportar.addEventListener("click", (e) => {
    e.stopPropagation();
    const aberto = !el.exportMenu.classList.contains("hidden");
    el.exportMenu.classList.toggle("hidden", aberto);
    el.btnExportar.setAttribute("aria-expanded", String(!aberto));
  });
  document.addEventListener("click", () => {
    el.exportMenu.classList.add("hidden");
    el.btnExportar.setAttribute("aria-expanded", "false");
  });

  el.exportMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-export]");
    if (!btn) return;
    e.stopPropagation();
    el.exportMenu.classList.add("hidden");
    await persistirDocAtual();
    await executarExportacao(btn.dataset.export, state.doc);
  });

  async function executarExportacao(tipo, doc) {
    try {
      toast("Gerando arquivo…", 1500);
      let resultado;
      if (tipo === "docx") resultado = await Exportar.exportarDocx(doc);
      else if (tipo === "pdf") resultado = await Exportar.exportarPdf(doc);
      else resultado = await Exportar.exportarTxt(doc);
      Exportar.baixarBlob(resultado.blob, resultado.filename);
      toast("Arquivo pronto: " + resultado.filename);
    } catch (err) {
      toast(err.message || "Não foi possível exportar agora.");
    }
  }

  async function compartilharDoc(doc) {
    abrirModal("Compartilhar \u201C" + (doc.titulo || "Sem título") + "\u201D como:", [
      { label: "📄 Word (.docx)", classe: "tbtn--ghost", onClick: () => compartilharFormato(doc, "docx") },
      { label: "🧾 PDF (.pdf)", classe: "tbtn--ghost", onClick: () => compartilharFormato(doc, "pdf") },
      { label: "✒️ Texto (.txt)", classe: "tbtn--ghost", onClick: () => compartilharFormato(doc, "txt") },
      { label: "Cancelar", classe: "tbtn--ghost" },
    ]);
  }

  async function compartilharFormato(doc, tipo) {
    try {
      toast("Preparando para compartilhar…", 1500);
      let resultado;
      if (tipo === "docx") resultado = await Exportar.exportarDocx(doc);
      else if (tipo === "pdf") resultado = await Exportar.exportarPdf(doc);
      else resultado = await Exportar.exportarTxt(doc);
      const r = await Exportar.compartilharArquivo(resultado.blob, resultado.filename, doc.titulo);
      if (r.via === "download") toast("Seu navegador baixou o arquivo: " + resultado.filename);
    } catch (err) {
      toast(err.message || "Não foi possível compartilhar agora.");
    }
  }

  el.btnShareEditor.addEventListener("click", async () => {
    await persistirDocAtual();
    compartilharDoc(state.doc);
  });

  // ---------------- Estudos de História ----------------
  function renderEstudos() {
    el.listaTecnicas.innerHTML = "";
    TECNICAS.forEach((t, i) => {
      const item = document.createElement("div");
      item.className = "acc-item";
      item.innerHTML = `
        <button class="acc-item__head" type="button" aria-expanded="false">
          <span>${t.titulo}</span>
          <svg class="acc-item__chevron" viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="acc-item__body"><div class="acc-item__body-inner">${t.texto}</div></div>
      `;
      item.querySelector(".acc-item__head").addEventListener("click", () => {
        const abrir = !item.classList.contains("open");
        item.classList.toggle("open", abrir);
        item.querySelector(".acc-item__head").setAttribute("aria-expanded", String(abrir));
      });
      el.listaTecnicas.appendChild(item);
    });

    el.listaTemas.innerHTML = "";
    TEMAS.forEach((tema) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.textContent = tema;
      chip.addEventListener("click", () => {
        iniciarNovoDoc(tema);
        mostrarView("editor");
        toast("Novo texto sobre " + tema);
        setTimeout(() => iniciarMic(), 300);
      });
      el.listaTemas.appendChild(chip);
    });
  }

  // ---------------- Meus arquivos ----------------
  function trechoTexto(conteudo, n) {
    const t = (conteudo || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  function criarDocCard(doc, { modoCompartilhar } = {}) {
    const card = document.createElement("div");
    card.className = "doc-card";
    const tagsHtml = doc.tema ? `<div class="doc-card__tags"><span class="doc-card__tag">${doc.tema}</span></div>` : "";
    card.innerHTML = `
      <div class="doc-card__top">
        <p class="doc-card__title">${doc.titulo || "Sem título"}</p>
        <span class="doc-card__date">${formatarDataCurta(doc.atualizadoEm)}</span>
      </div>
      ${tagsHtml}
      <p class="doc-card__snippet">${trechoTexto(doc.conteudo, 130) || "Sem conteúdo ainda."}</p>
      <div class="doc-card__actions"></div>
    `;
    const acoes = card.querySelector(".doc-card__actions");

    function botaoAcao(label, onClick, danger) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "doc-card__btn" + (danger ? " doc-card__btn--danger" : "");
      b.textContent = label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
      acoes.appendChild(b);
      return b;
    }

    if (modoCompartilhar) {
      botaoAcao("📤 Compartilhar", () => compartilharDoc(doc));
      botaoAcao("Abrir", () => abrirDocNoEditor(doc));
    } else {
      botaoAcao("Abrir", () => abrirDocNoEditor(doc));
      botaoAcao("📄 Word", () => executarExportacao("docx", doc));
      botaoAcao("🧾 PDF", () => executarExportacao("pdf", doc));
      botaoAcao("📤", () => compartilharDoc(doc));
      botaoAcao("Excluir", () => confirmarExclusao(doc), true);
    }

    card.addEventListener("click", () => abrirDocNoEditor(doc));
    return card;
  }

  function abrirDocNoEditor(doc) {
    pararMic();
    carregarDocNoEditor(Object.assign({}, doc));
    mostrarView("editor");
  }

  function confirmarExclusao(doc) {
    abrirModal("Excluir \u201C" + (doc.titulo || "Sem título") + "\u201D? Esta ação não pode ser desfeita.", [
      { label: "Cancelar", classe: "tbtn--ghost" },
      {
        label: "Excluir",
        classe: "tbtn--ghost",
        onClick: async () => {
          await DB.excluirDocumento(doc.id);
          toast("Texto excluído.");
          if (state.doc.id === doc.id) iniciarNovoDoc();
          renderArquivos();
          renderCompartilhar();
        },
      },
    ]);
  }

  let cacheArquivos = [];
  async function renderArquivos() {
    cacheArquivos = await DB.listarDocumentos();
    aplicarFiltroArquivos();
  }

  function aplicarFiltroArquivos() {
    const termo = (el.buscaArquivos.value || "").toLowerCase().trim();
    const filtrados = !termo
      ? cacheArquivos
      : cacheArquivos.filter(
          (d) => (d.titulo || "").toLowerCase().includes(termo) || (d.tema || "").toLowerCase().includes(termo)
        );
    el.listaArquivos.innerHTML = "";
    el.arquivosVazio.classList.toggle("hidden", filtrados.length > 0);
    filtrados.forEach((doc) => el.listaArquivos.appendChild(criarDocCard(doc)));
  }

  el.buscaArquivos.addEventListener("input", aplicarFiltroArquivos);

  async function renderCompartilhar() {
    const docs = await DB.listarDocumentos();
    el.listaCompartilhar.innerHTML = "";
    el.compartilharVazio.classList.toggle("hidden", docs.length > 0);
    docs.forEach((doc) => el.listaCompartilhar.appendChild(criarDocCard(doc, { modoCompartilhar: true })));
  }

  // ---------------- Status online/offline ----------------
  window.addEventListener("online", () => setStatusDot(state.ouvindo ? "recording" : "idle"));
  window.addEventListener("offline", () => setStatusDot("offline"));

  // ---------------- Service Worker ----------------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* offline no primeiro acesso: ok, tenta de novo depois */
      });
    });
  }

  // ---------------- Início ----------------
  document.addEventListener("DOMContentLoaded", () => {
    carregarDocNoEditor(docEmBranco());
    renderEstudos();
    mostrarView("editor");
    setStatusDot(navigator.onLine ? "idle" : "offline");
  });
})();
