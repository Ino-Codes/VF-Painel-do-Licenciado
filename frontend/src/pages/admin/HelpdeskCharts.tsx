import React, { useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
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

// ─── Formato dos dados (espelha o /api/admin/analytics/helpdesk) ────────────

export interface HelpdeskSeries {
  byStatus: Record<string, number>;
  byType: { type: string; count: number }[];
  bySystem: { name: string; count: number }[];
  daily: { dia: string; abertos: number; concluidos: number }[];
  byWeekdayHour: { dow: number; bloco: number; count: number }[];
  monthly: {
    mes: string;
    horas: number | null;
    horasP90: number | null;
    concluidos: number;
    espera: number | null;
    esperaP90: number | null;
    iniciados: number;
  }[];
  byAttendant: { name: string; count: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
};

// Ordem do funil de atendimento. "pausado" fica fora da escala (é um estado,
// não uma etapa), por isso recebe o cinza neutro.
const STATUS_FUNNEL = [
  { key: "novo", label: "Recebido" },
  { key: "analise", label: "Em análise" },
  { key: "andamento", label: "Em atendimento" },
  { key: "concluido", label: "Concluído" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOUR_BLOCKS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Datas chegam como texto puro (YYYY-MM-DD / YYYY-MM) justamente para não
// passarem por conversão de fuso no navegador.
const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const shortMonth = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
};

// Exportado para o card de KPI e o gráfico escreverem o mesmo valor do
// mesmo jeito. Vírgula decimal, como no resto do painel.
export const formatHoursShort = (h: number | null): string => {
  // `== null` cobre também undefined (backend anterior sem o campo).
  if (h == null || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${h.toFixed(1).replace(".", ",")}h`;
  return `${Math.round(h / 24)}d`;
};

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
const VIZ_PALETTE = {
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

interface Props {
  stats: HelpdeskSeries;
}

const HelpdeskCharts: React.FC<Props> = ({ stats }) => {
  const { theme } = useTheme();

  const palette = useMemo(
    () => VIZ_PALETTE[theme === "dark" ? "dark" : "light"],
    [theme],
  );

  // Eixos e tooltip compartilhados: grade recuada, texto em tom de texto.
  const baseOptions = useMemo<ChartOptions<any>>(
    () => ({
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
    }),
    [palette],
  );

  // ── 1. Abertos x concluídos (30 dias) ──
  const dailyData = useMemo(() => {
    const labels = stats.daily.map((d) => shortDay(d.dia));
    return {
      labels,
      datasets: [
        {
          label: "Abertos",
          data: stats.daily.map((d) => d.abertos),
          borderColor: palette.cat1,
          backgroundColor: `${palette.cat1}22`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Concluídos",
          data: stats.daily.map((d) => d.concluidos),
          borderColor: palette.cat2,
          backgroundColor: `${palette.cat2}22`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [stats.daily, palette]);

  const dailyOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: {
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
        },
      },
      scales: {
        ...baseOptions.scales,
        x: {
          ...(baseOptions.scales as any).x,
          ticks: {
            ...(baseOptions.scales as any).x.ticks,
            maxTicksLimit: 10,
            autoSkip: true,
          },
        },
      },
    }),
    [baseOptions, palette],
  );

  // ── 2. Barras horizontais (tipo e canal) ──
  const horizontalOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      indexAxis: "y" as const,
      interaction: { mode: "nearest" as const, intersect: true },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: {
            color: palette.textMuted,
            font: { size: 11 },
            precision: 0,
          },
        },
        y: {
          grid: { display: false },
          border: { color: palette.grid },
          ticks: { color: palette.text, font: { size: 12 } },
        },
      },
    }),
    [baseOptions, palette],
  );

  const typeData = useMemo(() => {
    const rows = [...stats.byType].sort((a, b) => b.count - a.count);
    return {
      labels: rows.map((r) => TYPE_LABELS[r.type] || r.type),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: palette.seq[2],
          hoverBackgroundColor: palette.seq[3],
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        },
      ],
    };
  }, [stats.byType, palette]);

  const systemData = useMemo(() => {
    const rows = [...stats.bySystem].sort((a, b) => b.count - a.count);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: palette.seq[2],
          hoverBackgroundColor: palette.seq[3],
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    };
  }, [stats.bySystem, palette]);

  const attendantData = useMemo(() => {
    const rows = [...stats.byAttendant].sort((a, b) => b.count - a.count);
    return {
      labels: rows.map((r) => r.name),
      datasets: [
        {
          data: rows.map((r) => r.count),
          backgroundColor: palette.seq[2],
          hoverBackgroundColor: palette.seq[3],
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    };
  }, [stats.byAttendant, palette]);

  // ── 3. Tempo médio de resolução por mês ──
  const monthlyData = useMemo(
    () => ({
      labels: stats.monthly.map((m) => shortMonth(m.mes)),
      datasets: [
        {
          label: "Tempo de resolução",
          data: stats.monthly.map((m) =>
            m.horas == null ? null : Number(m.horas.toFixed(2)),
          ),
          borderColor: palette.cat2,
          backgroundColor: `${palette.cat2}22`,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: palette.cat2,
          tension: 0.3,
          fill: true,
        },
        {
          // Tracejada: a distinção entre as duas linhas não fica só na cor.
          // Mesma estatística e mesma régua da resolução (mediana, horas úteis).
          label: "Tempo até o início",
          data: stats.monthly.map((m) =>
            m.espera == null ? null : Number(m.espera.toFixed(2)),
          ),
          borderColor: palette.seq[1],
          backgroundColor: `${palette.seq[1]}22`,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: palette.seq[1],
          tension: 0.3,
          fill: false,
        },
      ],
    }),
    [stats.monthly, palette],
  );

  const monthlyOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: {
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
        },
        tooltip: {
          ...(baseOptions.plugins as any).tooltip,
          callbacks: {
            // As duas linhas são a mediana; o p90 vai no tooltip para a
            // cauda (o chamado esquecido) não sumir do gráfico.
            label: (ctx: any) => {
              const m = stats.monthly[ctx.dataIndex];
              if (ctx.datasetIndex === 1) {
                return ` Até o início: ${formatHoursShort(m?.espera ?? null)} · 90% em até ${formatHoursShort(m?.esperaP90 ?? null)} · ${m?.iniciados ?? 0} atendido(s)`;
              }
              return ` Resolução: ${formatHoursShort(m?.horas ?? null)} · 90% em até ${formatHoursShort(m?.horasP90 ?? null)} · ${m?.concluidos ?? 0} concluído(s)`;
            },
          },
        },
      },
    }),
    [baseOptions, stats.monthly, palette],
  );

  // ── 4. Funil de status (barra empilhada em HTML) ──
  const funnel = useMemo(() => {
    const itens = STATUS_FUNNEL.map((s, i) => ({
      ...s,
      count: stats.byStatus[s.key] || 0,
      color: palette.seq[i],
    }));
    const pausado = stats.byStatus.pausado || 0;
    if (pausado > 0) {
      itens.push({
        key: "pausado",
        label: "Pausado",
        count: pausado,
        color: palette.neutral,
      });
    }
    const total = itens.reduce((acc, i) => acc + i.count, 0);
    return { itens, total };
  }, [stats.byStatus, palette]);

  // ── 5. Mapa de calor (dia da semana x faixa de hora) ──
  const heatmap = useMemo(() => {
    const grid: number[][] = WEEKDAYS.map(() => HOUR_BLOCKS.map(() => 0));
    stats.byWeekdayHour.forEach((c) => {
      if (grid[c.dow] && grid[c.dow][c.bloco] !== undefined) {
        grid[c.dow][c.bloco] = c.count;
      }
    });
    const max = Math.max(0, ...grid.flat());
    return { grid, max };
  }, [stats.byWeekdayHour]);

  const heatColor = (n: number) => {
    if (!heatmap.max || n === 0) return "var(--viz-empty)";
    // 5 degraus da rampa sequencial, proporcionais ao máximo.
    const step = Math.min(4, Math.floor((n / heatmap.max) * 5 - 0.0001) + 0);
    return palette.seq[Math.max(0, step)];
  };

  const semDados = funnel.total === 0;

  return (
    <div className="viz-section">
      {/* ── Evolução ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Abertos x Concluídos</h3>
          <span className="viz-card-sub">últimos 30 dias</span>
        </div>
        <div className="viz-canvas viz-canvas--tall">
          <Line data={dailyData} options={dailyOptions} />
        </div>
      </div>

      {/* ── Funil de status ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Distribuição por status</h3>
          <span className="viz-card-sub">
            {funnel.total} chamado{funnel.total === 1 ? "" : "s"}
          </span>
        </div>

        {semDados ? (
          <p className="viz-empty">Sem chamados registrados ainda.</p>
        ) : (
          <>
            <div
              className="viz-stack"
              role="img"
              aria-label={funnel.itens
                .map((i) => `${i.label}: ${i.count}`)
                .join(", ")}
            >
              {funnel.itens
                .filter((i) => i.count > 0)
                .map((i) => (
                  <span
                    key={i.key}
                    className="viz-stack-seg"
                    title={`${i.label}: ${i.count}`}
                    style={
                      {
                        "--seg-w": `${(i.count / funnel.total) * 100}%`,
                        "--seg-c": i.color,
                      } as React.CSSProperties
                    }
                  />
                ))}
            </div>
            <ul className="viz-legend">
              {funnel.itens.map((i) => (
                <li key={i.key}>
                  <span
                    className="viz-legend-dot"
                    style={{ "--seg-c": i.color } as React.CSSProperties}
                  />
                  <span className="viz-legend-label">{i.label}</span>
                  <strong className="viz-legend-value">{i.count}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── Tipo e canal ── */}
      <div className="viz-card">
        <div className="viz-card-head">
          <h3>Por tipo</h3>
        </div>
        <div className="viz-canvas">
          {stats.byType.length ? (
            <Bar data={typeData} options={horizontalOptions} />
          ) : (
            <p className="viz-empty">Sem dados.</p>
          )}
        </div>
      </div>

      <div className="viz-card">
        <div className="viz-card-head">
          <h3>Por canal de origem</h3>
        </div>
        <div className="viz-canvas">
          {stats.bySystem.length ? (
            <Bar data={systemData} options={horizontalOptions} />
          ) : (
            <p className="viz-empty">Sem dados.</p>
          )}
        </div>
      </div>

      {/* ── Mapa de calor ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Quando os chamados chegam</h3>
          <span className="viz-card-sub">dia da semana × faixa de horário</span>
        </div>

        {heatmap.max === 0 ? (
          <p className="viz-empty">Sem chamados registrados ainda.</p>
        ) : (
          <>
            <div className="viz-heat">
              <span />
              {HOUR_BLOCKS.map((h) => (
                <span key={h} className="viz-heat-col">
                  {h}
                </span>
              ))}
              {WEEKDAYS.map((dia, d) => (
                <React.Fragment key={dia}>
                  <span className="viz-heat-row">{dia}</span>
                  {HOUR_BLOCKS.map((bloco, b) => (
                    <span
                      key={bloco}
                      className="viz-heat-cell"
                      title={`${dia}, ${bloco}h — ${heatmap.grid[d][b]} chamado(s)`}
                      style={
                        {
                          "--cell-c": heatColor(heatmap.grid[d][b]),
                        } as React.CSSProperties
                      }
                    >
                      {heatmap.grid[d][b] > 0 ? heatmap.grid[d][b] : ""}
                    </span>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="viz-heat-scale">
              <span>menos</span>
              {palette.seq.map((c, i) => (
                <span
                  key={i}
                  className="viz-heat-scale-step"
                  style={{ "--cell-c": c } as React.CSSProperties}
                />
              ))}
              <span>mais</span>
            </div>
          </>
        )}
      </div>

      {/* ── Tempo de resolução ── */}
      <div className="viz-card">
        <div className="viz-card-head">
          <h3>Tempos de atendimento</h3>
          <span className="viz-card-sub">mediana por mês · horário comercial</span>
        </div>
        <div className="viz-canvas">
          {stats.monthly.length ? (
            <Line data={monthlyData} options={monthlyOptions} />
          ) : (
            <p className="viz-empty">Sem chamados concluídos ainda.</p>
          )}
        </div>
      </div>

      {/* ── Atendentes ── */}
      <div className="viz-card">
        <div className="viz-card-head">
          <h3>Concluídos por atendente</h3>
        </div>
        <div className="viz-canvas">
          {stats.byAttendant.length ? (
            <Bar data={attendantData} options={horizontalOptions} />
          ) : (
            <p className="viz-empty">Sem chamados concluídos ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpdeskCharts;
