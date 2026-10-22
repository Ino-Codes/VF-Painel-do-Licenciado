// Paleta e estilo comuns dos gráficos das Estatísticas (Chamados, Cursos).
//
// A paleta fica aqui, em JS, e NÃO é lida do CSS com getComputedStyle.
// Motivo: o ThemeProvider aplica a classe `dark-theme` ao body dentro de um
// useEffect, que roda DEPOIS do render deste componente. Uma leitura do DOM
// durante o render devolveria as cores do tema anterior, e a legenda do
// gráfico aparecia em quase-preto sobre o fundo escuro (sumia). Como estas
// cores são desenhadas em canvas e em style inline, ter os valores em JS é
// determinístico e não depende da ordem dos efeitos.
//
// Rampa sequencial dourada + dupla categórica, ambas validadas para
// contraste e daltonismo. O modo escuro tem degraus próprios, não um
// espelho automático do claro.
export const VIZ_PALETTE = {
  light: {
    seq: ["#cdae6b", "#b8944e", "#9e7c3c", "#836731", "#6a5327"],
    cat1: "#2a78d6",
    cat2: "#1baf3b",
    neutral: "#9aa1ab",
    grid: "rgba(0, 0, 0, 0.08)",
    text: "#0a0a0a",
    textMuted: "#6c757d",
    surface: "#ffffff",
  },
  dark: {
    seq: ["#6b5226", "#8a6c35", "#a8843f", "#c9a55c", "#e6c98a"],
    cat1: "#3987e5",
    cat2: "#199e48",
    neutral: "#767d88",
    grid: "rgba(255, 255, 255, 0.10)",
    text: "#f5f5f5",
    textMuted: "#9aa0a6",
    surface: "#0d0d0d",
  },
};

export type VizPalette = (typeof VIZ_PALETTE)["light"];

// Tooltip no estilo dos cards: superfície do tema, texto em tom de texto.
export const tooltipStyle = (palette: VizPalette) => ({
  backgroundColor: palette.surface,
  titleColor: palette.text,
  bodyColor: palette.text,
  footerColor: palette.textMuted,
  borderColor: palette.grid,
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 6,
  usePointStyle: true,
  titleFont: { size: 12, weight: 600 },
  bodyFont: { size: 12, weight: 500 },
  footerFont: { size: 11, weight: 500 },
});

// Legenda em canvas com o mesmo marcador redondo da legenda em HTML.
export const legendStyle = (palette: VizPalette) => ({
  display: true,
  position: "top" as const,
  align: "end" as const,
  labels: {
    color: palette.text,
    usePointStyle: true,
    pointStyle: "circle",
    boxWidth: 8,
    boxHeight: 8,
    padding: 20,
    font: { size: 12, weight: 600 },
  },
});
