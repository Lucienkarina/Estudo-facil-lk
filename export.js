/* =========================================================
   export.js — exportação para Word (.docx), PDF e .txt,
   além do compartilhamento nativo do iPhone.
   Tudo roda no navegador, sem backend.
   ========================================================= */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nomeArquivoSeguro(titulo) {
    const base = (titulo || "texto").trim() || "texto";
    return base
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "texto";
  }

  function paragrafosDe(conteudo) {
    return (conteudo || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  // ---------------- Word (.docx) ----------------
  function construirHtmlDocumento(doc) {
    const paragrafos = paragrafosDe(doc.conteudo)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("\n");
    const dataFormatada = new Date(doc.atualizadoEm || Date.now()).toLocaleDateString("pt-BR");
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.titulo)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #222; }
  h1 { font-size: 22pt; margin-bottom: 4pt; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 18pt; }
  p { font-size: 12pt; line-height: 1.6; margin: 0 0 12pt; text-align: justify; }
</style>
</head>
<body>
  <h1>${escapeHtml(doc.titulo)}</h1>
  <div class="meta">${doc.tema ? escapeHtml(doc.tema) + " · " : ""}${dataFormatada} · Estudo Fácil</div>
  ${paragrafos || "<p></p>"}
</body>
</html>`;
  }

  async function exportarDocx(doc) {
    if (!global.htmlDocx) {
      throw new Error("Biblioteca de exportação para Word ainda está carregando. Tente novamente em instantes.");
    }
    const html = construirHtmlDocumento(doc);
    const blob = global.htmlDocx.asBlob(html);
    return { blob, filename: nomeArquivoSeguro(doc.titulo) + ".docx" };
  }

  // ---------------- PDF ----------------
  async function exportarPdf(doc) {
    if (!global.jspdf) {
      throw new Error("Biblioteca de exportação para PDF ainda está carregando. Tente novamente em instantes.");
    }
    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const margin = 56;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    const linhasTitulo = pdf.splitTextToSize(doc.titulo || "Sem título", maxWidth);
    pdf.text(linhasTitulo, margin, y);
    y += linhasTitulo.length * 21 + 4;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(120);
    const dataFormatada = new Date(doc.atualizadoEm || Date.now()).toLocaleDateString("pt-BR");
    pdf.text(`${doc.tema ? doc.tema + " · " : ""}${dataFormatada} · Estudo Fácil`, margin, y);
    y += 22;
    pdf.setTextColor(30);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11.5);
    const paragrafos = paragrafosDe(doc.conteudo);
    const lineHeight = 16;

    (paragrafos.length ? paragrafos : [""]).forEach((par) => {
      const linhas = pdf.splitTextToSize(par, maxWidth);
      linhas.forEach((linha) => {
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(linha, margin, y);
        y += lineHeight;
      });
      y += lineHeight * 0.6;
    });

    const blob = pdf.output("blob");
    return { blob, filename: nomeArquivoSeguro(doc.titulo) + ".pdf" };
  }

  // ---------------- Texto simples (.txt) ----------------
  async function exportarTxt(doc) {
    const conteudo = `${doc.titulo || "Sem título"}\n\n${doc.conteudo || ""}`;
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    return { blob, filename: nomeArquivoSeguro(doc.titulo) + ".txt" };
  }

  // ---------------- Download local (fallback) ----------------
  function baixarBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------------- Compartilhar (menu nativo do iPhone) ----------------
  async function compartilharArquivo(blob, filename, tituloTexto) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (global.navigator.canShare && global.navigator.canShare({ files: [file] })) {
        await global.navigator.share({
          files: [file],
          title: tituloTexto || "Estudo Fácil",
        });
        return { ok: true, via: "share-file" };
      }
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, via: "cancelado" };
      // cai para o fallback abaixo
    }

    if (global.navigator.share) {
      try {
        await global.navigator.share({ title: tituloTexto || "Estudo Fácil", text: tituloTexto || "" });
        return { ok: true, via: "share-texto" };
      } catch (e) {
        if (e && e.name === "AbortError") return { ok: false, via: "cancelado" };
      }
    }

    baixarBlob(blob, filename);
    return { ok: true, via: "download" };
  }

  global.EstudoFacilExport = {
    exportarDocx,
    exportarPdf,
    exportarTxt,
    baixarBlob,
    compartilharArquivo,
    nomeArquivoSeguro,
  };
})(window);
