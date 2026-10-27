import React, { useEffect, useMemo, useState } from "react";
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
import toast from "react-hot-toast";
import { FaUserTie } from "react-icons/fa";
import {
  HiOutlineAcademicCap,
  HiOutlineBadgeCheck,
  HiOutlineBookOpen,
  HiOutlineClipboardCheck,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
} from "react-icons/hi";
import api from "../../api.ts";
import { useTheme } from "../../context/ThemeContext.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { VIZ_PALETTE, legendStyle, tooltipStyle } from "./vizTheme.ts";

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

// ─── Formato dos dados (espelha o /api/admin/analytics/courses) ─────────────

interface CursoStats {
  id: number;
  titulo: string;
  empresa: string | null;
  ativo: boolean;
  totalAulas: number;
  iniciados: number;
  concluidos: number;
  progressoMedio: number | null;
  quizAlunos: number;
  quizAprovados: number;
  quizNotaMedia: number | null;
  notaCorte: number | null;
}

interface CourseStats {
  resumo: {
    cursosAtivos: number;
    alunos: number;
    aulas: number;
    aulas30d: number;
    aulas30dAnterior: number;
    iniciados: number;
    concluidos: number;
    certificados: number;
    quiz: {
      alunos: number;
      aprovados: number;
      notaMedia: number | null;
      tentativasMedia: number | null;
    };
  };
  semanal: { semana: string; aulas: number; alunos: number }[];
  porCurso: CursoStats[];
  /** Melhor nota de cada aluno em cada quiz, nas faixas de FAIXAS_NOTA. */
  notas: number[];
  porSetor: { setor: string; aulas: number; alunos: number }[];
  ranking: {
    id: number;
    nome: string;
    avatarUrl: string | null;
    setor: string | null;
    aulas: number;
    cursosConcluidos: number;
    ultimaAtividade: string;
  }[];
}

const PUBLICO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "internos", label: "Colaboradores" },
  { value: "vpartners", label: "V-Partners" },
];

// As duas últimas faixas ficam acima da nota de corte padrão (70).
const FAIXAS_NOTA = ["0–49", "50–69", "70–89", "90–100"];
const NOTA_CORTE_PADRAO = 70;

// Cursos no gráfico de progresso; a tabela no fim lista todos.
const MAX_CURSOS_GRAFICO = 8;

// Progresso do aluno no curso: dois degraus da rampa dourada (mais escuro =
// mais avançado). No escuro a rampa é invertida, então os índices mudam.
const DEGRAUS_PROGRESSO = {
  light: { parcial: 0, completo: 3 },
  dark: { parcial: 1, completo: 4 },
};

// ─── Formatação ──────────────────────────────────────────────────────────────

const pct = (parte: number, total: number): number | null =>
  total > 0 ? Math.round((parte / total) * 100) : null;

const formatPct = (v: number | null) => (v == null ? "—" : `${v}%`);

/** 8.5 → "8,5" */
const formatNum = (n: number | null | undefined) =>
  n == null ? "—" : String(n).replace(".", ",");

// Datas chegam como texto puro (YYYY-MM-DD), sem passar por fuso no navegador.
const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const fullDay = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

const truncar = (texto: string, max = 26) =>
  texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;

// ─── Componente ──────────────────────────────────────────────────────────────

const CourseEngagementDash: React.FC = () => {
  const { theme } = useTheme();
  const modo = theme === "dark" ? "dark" : "light";
  const palette = VIZ_PALETTE[modo];
  const corParcial = palette.seq[DEGRAUS_PROGRESSO[modo].parcial];
  const corCompleto = palette.seq[DEGRAUS_PROGRESSO[modo].completo];

  const [empresa, setEmpresa] = useState("all");
  const [publico, setPublico] = useState("todos");
  const [dados, setDados] = useState<CourseStats | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCarregando(true);
    api
      .get("/api/admin/analytics/courses", { params: { empresa, publico } })
      .then((res) => {
        if (!vigente) return;
        setDados(res.data);
        setErro(false);
      })
      .catch(() => {
        if (!vigente) return;
        setErro(true);
        toast.error("Não foi possível carregar as estatísticas de cursos.");
      })
      .finally(() => {
        if (vigente) setCarregando(false);
      });
    return () => {
      vigente = false;
    };
  }, [empresa, publico]);

  // Eixos e tooltip compartilhados: grade recuada, texto em tom de texto.
  const baseOptions = useMemo<ChartOptions<any>>(
    () => ({
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
          ticks: { color: palette.textMuted, font: { size: 11 }, precision: 0 },
        },
      },
    }),
    [palette],
  );

  // Barras horizontais: o eixo de valores vira o x; os rótulos (cursos,
  // setores) ficam em tom de texto, truncados — o nome inteiro vai na dica.
  const horizontalOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      indexAxis: "y" as const,
      interaction: { mode: "index" as const, axis: "y" as const, intersect: false },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: { color: palette.textMuted, font: { size: 11 }, precision: 0 },
        },
        y: {
          grid: { display: false },
          border: { color: palette.grid },
          ticks: {
            color: palette.text,
            font: { size: 12 },
            // Em tela estreita o rótulo come o espaço da barra: corta antes.
            callback: function (this: any, valor: any) {
              const max = this.chart.width < 480 ? 14 : 26;
              return truncar(String(this.getLabelForValue(valor)), max);
            },
          },
        },
      },
    }),
    [baseOptions, palette],
  );

  // ── 1. Atividade semanal ──
  const semanalData = useMemo(() => {
    const semanas = dados?.semanal ?? [];
    return {
      labels: semanas.map((s) => shortDay(s.semana)),
      datasets: [
        {
          label: "Aulas concluídas",
          data: semanas.map((s) => s.aulas),
          borderColor: palette.cat1,
          backgroundColor: `${palette.cat1}22`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Alunos ativos",
          data: semanas.map((s) => s.alunos),
          borderColor: palette.cat2,
          backgroundColor: palette.cat2,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: false,
        },
      ],
    };
  }, [dados, palette]);

  const semanalOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: legendStyle(palette),
        tooltip: {
          ...tooltipStyle(palette),
          callbacks: {
            title: (itens: any[]) => `Semana de ${itens[0]?.label ?? ""}`,
          },
        },
      },
    }),
    [baseOptions, palette],
  );

  // ── 2. Progresso por curso (concluíram × em andamento) ──
  const cursosGrafico = useMemo(
    () =>
      (dados?.porCurso ?? [])
        .filter((c) => c.iniciados > 0)
        .slice(0, MAX_CURSOS_GRAFICO),
    [dados],
  );

  const progressoData = useMemo(
    () => ({
      labels: cursosGrafico.map((c) => c.titulo),
      datasets: [
        {
          label: "Concluíram",
          data: cursosGrafico.map((c) => c.concluidos),
          backgroundColor: corCompleto,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        },
        {
          label: "Em andamento",
          data: cursosGrafico.map((c) => c.iniciados - c.concluidos),
          backgroundColor: corParcial,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        },
      ],
    }),
    [cursosGrafico, corCompleto, corParcial],
  );

  const progressoOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...horizontalOptions,
      plugins: {
        ...horizontalOptions.plugins,
        legend: legendStyle(palette),
        tooltip: {
          ...tooltipStyle(palette),
          callbacks: {
            footer: (itens: any[]) => {
              const curso = cursosGrafico[itens[0]?.dataIndex];
              if (!curso) return "";
              return [
                `Taxa de conclusão: ${formatPct(pct(curso.concluidos, curso.iniciados))}`,
                `Progresso médio: ${formatPct(curso.progressoMedio)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { ...(horizontalOptions.scales as any).x, stacked: true },
        y: { ...(horizontalOptions.scales as any).y, stacked: true },
      },
    }),
    [horizontalOptions, palette, cursosGrafico],
  );

  // ── 3. Aprovação no quiz por curso ──
  const cursosQuiz = useMemo(
    () =>
      (dados?.porCurso ?? [])
        .filter((c) => c.quizAlunos > 0)
        .sort((a, b) => b.quizAlunos - a.quizAlunos)
        .slice(0, MAX_CURSOS_GRAFICO),
    [dados],
  );

  const quizData = useMemo(
    () => ({
      labels: cursosQuiz.map((c) => c.titulo),
      datasets: [
        {
          label: "Aprovação",
          data: cursosQuiz.map((c) => pct(c.quizAprovados, c.quizAlunos)),
          backgroundColor: palette.seq[2],
          hoverBackgroundColor: palette.seq[3],
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        },
      ],
    }),
    [cursosQuiz, palette],
  );

  const quizOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...horizontalOptions,
      plugins: {
        ...horizontalOptions.plugins,
        tooltip: {
          ...tooltipStyle(palette),
          callbacks: {
            label: (item: any) => {
              const c = cursosQuiz[item.dataIndex];
              return ` Aprovação: ${item.raw}% (${c.quizAprovados} de ${plural(c.quizAlunos, "aluno", "alunos")})`;
            },
            footer: (itens: any[]) => {
              const c = cursosQuiz[itens[0]?.dataIndex];
              return c
                ? `Nota média: ${formatNum(c.quizNotaMedia)} · corte: ${c.notaCorte ?? NOTA_CORTE_PADRAO}`
                : "";
            },
          },
        },
      },
      scales: {
        ...horizontalOptions.scales,
        x: {
          ...(horizontalOptions.scales as any).x,
          max: 100,
          ticks: {
            ...(horizontalOptions.scales as any).x.ticks,
            stepSize: 25,
            callback: (v: any) => `${v}%`,
          },
        },
      },
    }),
    [horizontalOptions, palette, cursosQuiz],
  );

  // ── 4. Distribuição das notas ──
  // Ênfase: abaixo do corte em cinza, a partir do corte no dourado.
  const notasData = useMemo(
    () => ({
      labels: FAIXAS_NOTA,
      datasets: [
        {
          label: "Alunos",
          data: dados?.notas ?? [],
          backgroundColor: FAIXAS_NOTA.map((_, i) =>
            i >= 2 ? palette.seq[2] : palette.neutral,
          ),
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 56,
        },
      ],
    }),
    [dados, palette],
  );

  const notasOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...tooltipStyle(palette),
          displayColors: false,
          callbacks: {
            title: (itens: any[]) => `Nota ${itens[0]?.label ?? ""}`,
            label: (item: any) => ` ${plural(item.raw, "aluno", "alunos")}`,
          },
        },
      },
    }),
    [baseOptions, palette],
  );

  // ── 5. Engajamento por setor ──
  const setorData = useMemo(() => {
    const setores = dados?.porSetor ?? [];
    return {
      labels: setores.map((s) => s.setor),
      datasets: [
        {
          label: "Aulas concluídas",
          data: setores.map((s) => s.aulas),
          backgroundColor: palette.seq[2],
          hoverBackgroundColor: palette.seq[3],
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 22,
        },
      ],
    };
  }, [dados, palette]);

  const setorOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...horizontalOptions,
      plugins: {
        ...horizontalOptions.plugins,
        tooltip: {
          ...tooltipStyle(palette),
          callbacks: {
            footer: (itens: any[]) => {
              const s = dados?.porSetor[itens[0]?.dataIndex];
              return s ? plural(s.alunos, "aluno", "alunos") : "";
            },
          },
        },
      },
    }),
    [horizontalOptions, palette, dados],
  );

  if (!dados) {
    if (carregando) {
      return <LoadingSpinner variant="inline" label="Carregando dados" />;
    }
    return (
      <p className="tela-loading">
        {erro
          ? "Não foi possível carregar os dados. Tente novamente mais tarde."
          : "Ainda não há dados de cursos para exibir."}
      </p>
    );
  }

  const { resumo } = dados;
  const semAtividade = resumo.alunos === 0;
  const deltaAulas = resumo.aulas30d - resumo.aulas30dAnterior;
  const maxRanking = dados.ranking[0]?.aulas || 1;

  // Altura das barras horizontais acompanha a quantidade de linhas, para a
  // espessura da barra ficar igual com 1 ou com 8 cursos.
  const alturaBarras = (linhas: number) => ({
    "--viz-h": `${Math.max(140, linhas * 44 + 48)}px`,
  } as React.CSSProperties);

  return (
    <div className={`course-stats${carregando ? " course-stats--refreshing" : ""}`}>
      {/* ── Filtros: valem para todos os indicadores abaixo ── */}
      <div className="course-stats-filters">
        <div className="course-stats-filter">
          <span className="course-stats-filter-label">Empresa do curso</span>
          <CompanyFilter value={empresa} onChange={setEmpresa} />
        </div>
        <div className="course-stats-filter">
          <span className="course-stats-filter-label">Público</span>
          <div className="company-filter" role="group" aria-label="Filtrar por público">
            {PUBLICO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`company-filter-btn${
                  publico === opt.value ? " company-filter-btn--active" : ""
                }`}
                aria-pressed={publico === opt.value}
                onClick={() => setPublico(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Indicadores ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineUserGroup />
          </div>
          <div className="stat-info">
            <h3>{resumo.alunos}</h3>
            <p>Alunos engajados</p>
            <span className="stat-sub">com ao menos uma aula concluída</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineBookOpen />
          </div>
          <div className="stat-info">
            <h3>{resumo.aulas}</h3>
            <p>Aulas concluídas</p>
            <span className="stat-sub">
              {resumo.aulas30d} nos últimos 30 dias
              {deltaAulas !== 0 && (
                <span className="stat-delta">
                  {deltaAulas > 0 ? "▲" : "▼"} {Math.abs(deltaAulas)} vs. 30 dias
                  anteriores
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineAcademicCap />
          </div>
          <div className="stat-info">
            <h3>{formatPct(pct(resumo.concluidos, resumo.iniciados))}</h3>
            <p>Taxa de conclusão</p>
            <span className="stat-sub">
              {resumo.concluidos} de {plural(resumo.iniciados, "curso iniciado", "cursos iniciados")}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineClipboardCheck />
          </div>
          <div className="stat-info">
            <h3>{formatPct(pct(resumo.quiz.aprovados, resumo.quiz.alunos))}</h3>
            <p>Aprovação nos quizzes</p>
            <span className="stat-sub">
              {resumo.quiz.alunos > 0
                ? `nota média ${formatNum(resumo.quiz.notaMedia)} · ${formatNum(
                    resumo.quiz.tentativasMedia,
                  )} tentativas por aluno`
                : "nenhum quiz respondido"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineBadgeCheck />
          </div>
          <div className="stat-info">
            <h3>{resumo.certificados}</h3>
            <p>Certificados emitidos</p>
            <span className="stat-sub">gerados pelos alunos que concluíram</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineDocumentText />
          </div>
          <div className="stat-info">
            <h3>{resumo.cursosAtivos}</h3>
            <p>Cursos ativos</p>
            <span className="stat-sub">com aulas cadastradas</span>
          </div>
        </div>
      </div>

      <div className="viz-section">
        {/* ── Atividade semanal ── */}
        <div className="viz-card viz-card--wide">
          <div className="viz-card-head">
            <h3>Atividade semanal</h3>
            <span className="viz-card-sub">últimas 12 semanas</span>
          </div>
          <div className="viz-canvas viz-canvas--tall">
            <Line data={semanalData} options={semanalOptions} />
          </div>
        </div>

        {/* ── Progresso por curso ── */}
        <div className="viz-card viz-card--wide">
          <div className="viz-card-head">
            <h3>Progresso por curso</h3>
            <span className="viz-card-sub">
              alunos que iniciaram
              {dados.porCurso.filter((c) => c.iniciados > 0).length > MAX_CURSOS_GRAFICO
                ? ` · ${MAX_CURSOS_GRAFICO} cursos mais procurados`
                : ""}
            </span>
          </div>
          {cursosGrafico.length ? (
            <div
              className="viz-canvas viz-canvas--auto"
              style={alturaBarras(cursosGrafico.length)}
            >
              <Bar data={progressoData} options={progressoOptions} />
            </div>
          ) : (
            <p className="viz-empty">Nenhum curso iniciado ainda.</p>
          )}
        </div>

        {/* ── Aprovação no quiz ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Aprovação no quiz</h3>
            <span className="viz-card-sub">alunos aprovados por curso</span>
          </div>
          {cursosQuiz.length ? (
            <div
              className="viz-canvas viz-canvas--auto"
              style={alturaBarras(cursosQuiz.length)}
            >
              <Bar data={quizData} options={quizOptions} />
            </div>
          ) : (
            <p className="viz-empty">Nenhum quiz respondido ainda.</p>
          )}
        </div>

        {/* ── Distribuição das notas ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Distribuição das notas</h3>
            <span className="viz-card-sub">melhor nota de cada aluno</span>
          </div>
          {resumo.quiz.alunos > 0 ? (
            <>
              <div className="viz-canvas">
                <Bar data={notasData} options={notasOptions} />
              </div>
              <ul className="viz-legend">
                <li>
                  <span
                    className="viz-legend-dot"
                    style={{ "--seg-c": palette.neutral } as React.CSSProperties}
                  />
                  <span className="viz-legend-label">
                    Abaixo da nota de corte ({NOTA_CORTE_PADRAO})
                  </span>
                </li>
                <li>
                  <span
                    className="viz-legend-dot"
                    style={{ "--seg-c": palette.seq[2] } as React.CSSProperties}
                  />
                  <span className="viz-legend-label">Aprovado</span>
                </li>
              </ul>
            </>
          ) : (
            <p className="viz-empty">Nenhum quiz respondido ainda.</p>
          )}
        </div>

        {/* ── Engajamento por setor ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Engajamento por setor</h3>
            <span className="viz-card-sub">aulas concluídas</span>
          </div>
          {dados.porSetor.length ? (
            <div
              className="viz-canvas viz-canvas--auto"
              style={alturaBarras(dados.porSetor.length)}
            >
              <Bar data={setorData} options={setorOptions} />
            </div>
          ) : (
            <p className="viz-empty">Nenhuma aula concluída ainda.</p>
          )}
        </div>

        {/* ── Ranking ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Alunos mais engajados</h3>
            <span className="viz-card-sub">top 10 · aulas concluídas</span>
          </div>
          {semAtividade ? (
            <p className="viz-empty">Nenhuma aula concluída ainda.</p>
          ) : (
            <ol className="course-ranking">
              {dados.ranking.map((aluno, i) => (
                <li key={aluno.id} className="course-ranking-item">
                  <span className="course-ranking-pos">{i + 1}</span>
                  <span className="course-ranking-avatar">
                    {aluno.avatarUrl ? (
                      <img src={aluno.avatarUrl} alt="" />
                    ) : (
                      <FaUserTie aria-hidden="true" />
                    )}
                  </span>
                  <div className="course-ranking-body">
                    <div className="course-ranking-line">
                      <span className="course-ranking-name">{aluno.nome}</span>
                      <strong className="course-ranking-value">
                        {plural(aluno.aulas, "aula", "aulas")}
                      </strong>
                    </div>
                    <div
                      className="course-ranking-meter"
                      style={
                        {
                          "--seg-w": `${(aluno.aulas / maxRanking) * 100}%`,
                          "--seg-c": palette.seq[2],
                        } as React.CSSProperties
                      }
                    />
                    <span className="course-ranking-meta">
                      {[
                        aluno.setor,
                        plural(aluno.cursosConcluidos, "curso concluído", "cursos concluídos"),
                        `última aula em ${fullDay(aluno.ultimaAtividade)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ── Detalhe por curso: a versão em tabela de todos os gráficos ── */}
        <div className="viz-card viz-card--wide">
          <div className="viz-card-head">
            <h3>Detalhe por curso</h3>
            <span className="viz-card-sub">{plural(dados.porCurso.length, "curso", "cursos")}</span>
          </div>
          {dados.porCurso.length ? (
            <div className="table-container">
              <table className="admin-table course-stats-table">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th>Empresa</th>
                    <th className="stats-th-center">Aulas</th>
                    <th className="stats-th-center">Iniciaram</th>
                    <th className="stats-th-center">Concluíram</th>
                    <th className="stats-th-center">Conclusão</th>
                    <th className="stats-th-center">Progresso</th>
                    <th className="stats-th-center">Aprovação quiz</th>
                    <th className="stats-th-center">Nota quiz</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porCurso.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.titulo}
                        {!c.ativo && <span className="course-stats-badge">inativo</span>}
                      </td>
                      <td>{c.empresa ?? "—"}</td>
                      <td className="stats-count-cell">{c.totalAulas}</td>
                      <td className="stats-count-cell">{c.iniciados}</td>
                      <td className="stats-count-cell">{c.concluidos}</td>
                      <td className="stats-count-cell">
                        {formatPct(pct(c.concluidos, c.iniciados))}
                      </td>
                      <td className="stats-count-cell">{formatPct(c.progressoMedio)}</td>
                      <td className="stats-count-cell">
                        {formatPct(pct(c.quizAprovados, c.quizAlunos))}
                      </td>
                      <td className="stats-count-cell">{formatNum(c.quizNotaMedia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="viz-empty">Nenhum curso com aulas para esta empresa.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseEngagementDash;
