import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { useTheme } from "../../context/ThemeContext.tsx";

// Base comum dos gráficos das Estatísticas do Painel (Atividade e Central de
// Chamados): registro do Chart.js, paleta e opções de eixo/tooltip/legenda.

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
);

// O Chart.js desenha em canvas, que não herda font-family do CSS: a família e
// os pesos precisam ser declarados aqui para os gráficos usarem a mesma
// tipografia do resto do painel.
const FONT_FAMILY = '"Montserrat", sans-serif';

ChartJS.defaults.font.family = FONT_FAMILY;
ChartJS.defaults.font.size = 11;
ChartJS.defaults.font.weight = 500;

// A paleta fica aqui, em JS, e NÃO é lida do CSS com getComputedStyle.
// Motivo: o ThemeProvider aplica a classe `dark-theme` ao body dentro de um
// useEffect, que roda DEPOIS do render dos gráficos. Uma leitura do DOM
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

/** Paleta do tema atual. */
export const useVizPalette = (): VizPalette => {
  const { theme } = useTheme();
  return useMemo(() => VIZ_PALETTE[theme === "dark" ? "dark" : "light"], [theme]);
};

/** Eixos e tooltip compartilhados: grade recuada, texto em tom de texto. */
export const opcoesBase = (palette: VizPalette): ChartOptions<any> => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: palette.surface,
      titleColor: palette.text,
      bodyColor: palette.text,
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
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: palette.grid },
      ticks: { color: palette.textMuted, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.grid },
      border: { display: false },
      ticks: {
        color: palette.textMuted,
        font: { size: 11 },
        precision: 0,
      },
    },
  },
});

/** Legenda no topo, à direita, com marcador redondo. */
export const legendaTopo = (palette: VizPalette) => ({
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

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Datas chegam como texto puro (YYYY-MM-DD / YYYY-MM) justamente para não
// passarem por conversão de fuso no navegador.
export const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
