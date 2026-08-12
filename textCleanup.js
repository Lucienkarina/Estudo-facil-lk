/* =========================================================
   textCleanup.js — normalização leve de português falado
   Objetivo: a aluna fala sem dizer "vírgula" ou "ponto", e o
   texto sai razoavelmente pontuado, capitalizado e organizado
   em parágrafos. Não substitui uma revisão humana, mas evita
   o trabalho manual mais chato.
   ========================================================= */
(function (global) {
  "use strict";

  // Palavras que, no início de uma nova frase falada após pausa curta,
  // costumam indicar continuação e ficam melhor com vírgula antes.
  const CONECTIVOS_VIRGULA = [
    "mas", "porém", "contudo", "então", "entao", "assim", "portanto",
    "ou seja", "além disso", "alem disso", "por exemplo", "ou melhor",
    "enfim", "logo", "porque não", "aliás", "alias",
  ];

  const MIN_LETTER = /[a-zà-ú]/i;

  function capitalizar(palavra) {
    if (!palavra) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }

  // Capitaliza início de texto e início de frase após . ! ?
  function capitalizarFrases(texto) {
    let out = "";
    let capitalizarProxima = true;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (capitalizarProxima && MIN_LETTER.test(ch)) {
        out += ch.toUpperCase();
        capitalizarProxima = false;
      } else {
        out += ch;
      }
      if (/[.!?]/.test(ch)) capitalizarProxima = true;
      else if (ch === "\n") capitalizarProxima = true;
    }
    return out;
  }

  // Corrige espaçamento ao redor de pontuação
  function corrigirEspacos(texto) {
    return texto
      .replace(/[ \t]+([,.;:!?])/g, "$1")           // sem espaço antes de pontuação
      .replace(/([,.;:!?])(?=[^\s\n])/g, "$1 ")       // um espaço depois
      .replace(/[ \t]{2,}/g, " ")                     // colapsa espaços duplos
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  // Capitaliza o pronome "eu" isolado
  function corrigirPronomes(texto) {
    return texto.replace(/\beu\b/g, "eu").replace(/(^|[.!?\n]\s*)eu\b/g, (m, p1) => p1 + "Eu");
  }

  // Garante ponto final no fim do texto, se terminar em letra/número
  function garantirPontoFinal(texto) {
    const t = texto.replace(/\s+$/, "");
    if (!t) return t;
    if (/[.!?…"”)]$/.test(t)) return t + (texto.match(/\s+$/) ? texto.match(/\s+$/)[0] : "");
    return t + ".";
  }

  /**
   * Limpa/normaliza um texto transcrito por voz.
   * Aplica: espaçamento, capitalização de frases, correção leve de
   * pronomes e pontuação final. Preserva quebras de parágrafo (\n\n).
   */
  function limparTexto(bruto) {
    if (!bruto) return "";
    let t = bruto.replace(/\r\n/g, "\n");
    t = corrigirEspacos(t);
    t = capitalizarFrases(t);
    t = corrigirPronomes(t);
    return t;
  }

  /**
   * Decide, a partir do tempo de silêncio (em ms) entre dois trechos
   * falados, qual separador inserir entre eles — sem que a aluna
   * precise dizer "ponto" ou "parágrafo".
   *   > 1600ms  → novo parágrafo
   *   > 550ms   → ponto final + espaço (nova frase)
   *   caso contrário → apenas espaço (mesma frase)
   */
  function separadorPorPausa(pausaMs) {
    if (pausaMs > 1600) return "\n\n";
    if (pausaMs > 550) return ". ";
    return " ";
  }

  /**
   * Junta um novo trecho reconhecido ao texto existente, aplicando
   * o separador adequado e uma capitalização mínima do trecho novo
   * quando ele começa uma frase/parágrafo.
   */
  function anexarTrecho(textoAtual, trecho, pausaMs) {
    let novo = (trecho || "").trim();
    if (!novo) return textoAtual;

    if (!textoAtual) {
      return capitalizar(novo);
    }

    const sep = separadorPorPausa(pausaMs);
    const iniciaFrase = sep === "\n\n" || sep === ". ";
    if (iniciaFrase) novo = capitalizar(novo);

    // Evita ". ." se o texto já termina com pontuação
    let base = textoAtual;
    if (sep === ". " && /[.!?]\s*$/.test(base)) {
      return base.replace(/\s*$/, "") + " " + novo;
    }
    if (sep === "\n\n" && /[.!?]\s*$/.test(base) === false) {
      base = base.replace(/\s*$/, "") + ".";
    }
    return base + sep + novo;
  }

  global.EstudoFacilTexto = {
    limparTexto,
    anexarTrecho,
    separadorPorPausa,
    garantirPontoFinal,
    contarPalavras: (t) => ((t || "").trim() ? t.trim().split(/\s+/).filter(Boolean).length : 0),
  };
})(window);
