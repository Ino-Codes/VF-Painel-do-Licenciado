// ═══════════════════════════════════════════════════════════════════════════
// Certificado de conclusão de curso — modelo único para todos os cursos
// ═══════════════════════════════════════════════════════════════════════════
// O modelo é o SVG entregue pelo design, guardado SEM alterações em
// assets/certificado/modelo-cursos.svg: textos são objetos editáveis com os
// campos variáveis entre colchetes; fundo e logotipo são imagens embutidas.
// Para trocar o modelo, basta substituir o arquivo mantendo os campos.
//
// Campos:
//   [Nome completo do aluno]          nome do usuário
//   [Nome completo do curso/evento]   título do curso
//   [Nome de quem assina]             sempre ASSINATURA (abaixo)
//   [Data de emissão]                 data em que o aluno concluiu o curso
//
// O PDF é gerado pelo Chromium (puppeteer) com a Montserrat EMBUTIDA: o
// servidor não tem a fonte instalada e, sem ela, o texto cairia numa fonte
// serifada qualquer.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const MODELO = path.join(__dirname, "..", "assets", "certificado", "modelo-cursos.svg");
const ASSINATURA = "V-CORP SOLUÇÕES CORPORATIVAS";

const CAMPOS = {
  aluno: "[Nome completo do aluno]",
  curso: "[Nome completo do curso/evento]",
  assinatura: "[Nome de quem assina]",
  data: "[Data de emissão]",
};

// Largura útil do texto, em pontos (unidades do viewBox do modelo): da margem
// esquerda até antes do grafismo dourado do lado direito do fundo.
const LARGURA_MAX = 500;

// ── Fonte embutida ─────────────────────────────────────────────────────────
// Montserrat 300 (Light), 400 (Regular) e 600 (SemiBold), nos subconjuntos
// latin e latin-ext (mesmos unicode-range do Google Fonts).
const UNICODE_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const UNICODE_LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

let _fontes = null;
const fontesCss = () => {
  if (_fontes) return _fontes;
  const dir = path.dirname(require.resolve("@fontsource/montserrat/package.json"));
  const faces = [];
  for (const peso of [300, 400, 600]) {
    for (const [subset, range] of [["latin", UNICODE_LATIN], ["latin-ext", UNICODE_LATIN_EXT]]) {
      const arquivo = path.join(dir, "files", `montserrat-${subset}-${peso}-normal.woff2`);
      const b64 = fs.readFileSync(arquivo).toString("base64");
      faces.push(
        `@font-face{font-family:"Montserrat";font-style:normal;font-weight:${peso};` +
          `src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range};}`,
      );
    }
  }
  _fontes = faces.join("\n");
  return _fontes;
};

// ── Modelo ─────────────────────────────────────────────────────────────────
let _modelo = null;
const carregarModelo = () => {
  if (_modelo) return _modelo;
  let svg = fs.readFileSync(MODELO, "utf8");
  // Vai embutido no HTML: sem a declaração XML.
  svg = svg.replace(/<\?xml[^>]*\?>\s*/, "");
  // O design nomeia os pesos como famílias ("Montserrat SemiBold"); no CSS a
  // família é uma só e o peso vai em font-weight.
  svg = svg
    .replace(/font-family="Montserrat SemiBold"/g, 'font-family="Montserrat" font-weight="600"')
    .replace(/font-family="Montserrat Light"/g, 'font-family="Montserrat" font-weight="300"');
  // Um modelo novo sem algum dos campos geraria certificado incompleto em
  // silêncio — melhor falhar alto.
  for (const campo of Object.values(CAMPOS)) {
    if (!svg.includes(campo)) throw new Error(`Modelo de certificado sem o campo ${campo}.`);
  }
  _modelo = svg;
  return _modelo;
};

const escapeXml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Data por extenso no fuso de São Paulo: "20 de outubro de 2026". */
const dataPorExtenso = (data) =>
  new Date(data).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

/** HTML completo do certificado (uma página A4 paisagem). */
const montarHtml = ({ aluno, curso, dataConclusao }) => {
  const svg = carregarModelo()
    .replace(CAMPOS.aluno, escapeXml(String(aluno || "").trim()))
    .replace(CAMPOS.curso, escapeXml(String(curso || "").trim()))
    .replace(CAMPOS.assinatura, escapeXml(ASSINATURA))
    .replace(CAMPOS.data, escapeXml(dataPorExtenso(dataConclusao)));
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
${fontesCss()}
@page { size: 297mm 210mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #09090D; }
svg { display: block; width: 297mm; height: 210mm; }
</style></head>
<body>${svg}</body></html>`;
};

// Roda dentro da página, depois de a fonte carregar: ajusta os campos longos
// para não invadirem o grafismo do fundo.
//   • curso: reduz até 75% do tamanho; se ainda não couber, quebra em 2
//     linhas (e desce o "realizado pela empresa." junto); em último caso
//     reduz mais.
//   • aluno: reduz até 60%; em último caso comprime as letras.
// (Executa no navegador, via page.evaluate.)
function ajustarCampos(larguraMax) {
  const reduzir = (el, minimo) => {
    const base = parseFloat(el.getAttribute("font-size"));
    let tamanho = base;
    while (el.getComputedTextLength() > larguraMax && tamanho > base * minimo) {
      tamanho = Math.max(base * minimo, tamanho - 0.25);
      el.setAttribute("font-size", String(tamanho));
    }
    return tamanho;
  };

  const resultado = { curso: "1 linha", aluno: "normal" };

  // ── Nome do curso ──
  const curso = document.getElementById("texto-6");
  reduzir(curso, 0.75);
  if (curso.getComputedTextLength() > larguraMax) {
    const palavras = curso.textContent.trim().split(/\s+/);
    const x = curso.getAttribute("x");
    const tamanho = parseFloat(curso.getAttribute("font-size"));
    const medir = (texto) => {
      curso.textContent = texto;
      return curso.getComputedTextLength();
    };
    // Corte que deixa as duas linhas mais equilibradas.
    let melhor = 1;
    let menorMaior = Infinity;
    for (let i = 1; i < palavras.length; i++) {
      const maior = Math.max(medir(palavras.slice(0, i).join(" ")), medir(palavras.slice(i).join(" ")));
      if (maior < menorMaior) {
        menorMaior = maior;
        melhor = i;
      }
    }
    const linha1 = palavras.slice(0, melhor).join(" ");
    const linha2 = palavras.slice(melhor).join(" ");
    const entreLinhas = tamanho * 1.2;
    curso.textContent = "";
    const ns = "http://www.w3.org/2000/svg";
    for (const [i, texto] of [linha1, linha2].entries()) {
      const t = document.createElementNS(ns, "tspan");
      t.setAttribute("x", x);
      if (i > 0) t.setAttribute("dy", String(entreLinhas));
      t.textContent = texto;
      curso.appendChild(t);
    }
    // A linha extra empurra o complemento para baixo.
    const complemento = document.getElementById("texto-7");
    complemento.setAttribute("y", String(parseFloat(complemento.getAttribute("y")) + entreLinhas));
    // Linha ainda larga demais (palavra enorme): reduz mais, por linha.
    for (const t of curso.querySelectorAll("tspan")) {
      if (t.getComputedTextLength() > larguraMax) {
        curso.setAttribute("font-size", String(tamanho * (larguraMax / t.getComputedTextLength())));
      }
    }
    resultado.curso = "2 linhas";
  }

  // ── Nome do aluno ──
  const aluno = document.getElementById("texto-4");
  reduzir(aluno, 0.6);
  if (aluno.getComputedTextLength() > larguraMax) {
    aluno.setAttribute("textLength", String(larguraMax));
    aluno.setAttribute("lengthAdjust", "spacingAndGlyphs");
    resultado.aluno = "comprimido";
  }
  return resultado;
}

// Chromium: no servidor, o binário do @sparticuz/chromium; na máquina de
// desenvolvimento (Windows/macOS), um Chrome/Edge instalado indicado em
// CHROME_EXECUTABLE_PATH.
const abrirNavegador = async () => {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH, headless: true });
  }
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
};

/**
 * Gera o PDF do certificado.
 * @param {{ aluno: string, curso: string, dataConclusao: Date|string }} dados
 * @returns {Promise<{ pdf: Buffer, ajustes: object }>}
 */
async function gerarCertificadoCurso(dados) {
  const html = montarHtml(dados);
  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();
    await pagina.setContent(html, { waitUntil: "load" });
    await pagina.evaluate(() => document.fonts.ready);
    const ajustes = await pagina.evaluate(ajustarCampos, LARGURA_MAX);
    const pdf = await pagina.pdf({
      width: "297mm",
      height: "210mm",
      printBackground: true,
      preferCSSPageSize: true,
      pageRanges: "1",
    });
    return { pdf: Buffer.from(pdf), ajustes };
  } finally {
    await navegador.close();
  }
}

module.exports = {
  gerarCertificadoCurso,
  montarHtml,
  dataPorExtenso,
  ASSINATURA,
  LARGURA_MAX,
};
