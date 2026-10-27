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
import { VIZ_PALETTE, VizPalette, tooltipStyle, legendStyle } from "./vizTheme.ts";

// Base comum dos gráficos das Estatísticas do Painel: registro do Chart.js,
// fonte e opções de eixo/tooltip. A paleta e os estilos de tooltip/legenda
// vêm de vizTheme.ts (compartilhado com os gráficos de Cursos).

export { VIZ_PALETTE, tooltipStyle, legendStyle };
export type { VizPalette };

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
    tooltip: tooltipStyle(palette),
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

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Datas chegam como texto puro (YYYY-MM-DD / YYYY-MM) justamente para não
// passarem por conversão de fuso no navegador.
export const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
