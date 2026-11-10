import React, { useMemo, useState } from "react";
import { HiOutlineDocumentText } from "react-icons/hi";
import { Line } from "react-chartjs-2";
import { ChartOptions } from "chart.js";
import {
  useVizPalette,
  opcoesBase,
  legendStyle,
  WEEKDAYS,
  shortDay,
} from "./vizShared.ts";

// ─── Formato dos dados (espelha o /api/admin/analytics/system-usage) ────────

export type Publico = "interno" | "vpartner";
export type Faixa = "ativo30" | "ativo90" | "inativo" | "nunca";

export interface ActivityStats {
  dias: number;
  granularidade: "dia" | "semana";
  publicos: Record<
    Publico,
    {
      cadastrados: number;
      ativos7: number;
      ativosPeriodo: number;
      faixas: Record<Faixa, number>;
    }
  >;
  usuarios: {
    id: number;
    nome: string;
    email: string;
    publico: Publico;
    faixa: Faixa;
    ultimoLogin: string | null;
  }[];
  serie: {
    inicio: string;
    internos: number;
    vpartners: number;
    sucesso: number;
    falhas: number;
    /** Falhas de e-mail cadastrado (senha errada). Ausente em backend antigo. */
    falhasSenha?: number;
    /** Falhas com e-mail que não tem conta. */
    falhasEmail?: number;
    falhas2fa: number;
    senhasRedefinidas: number;
  }[];
  porDiaHora: { dow: number; hora: number; count: number }[];
  acesso: {
    sucesso: number;
    falhas: number;
    falhasCadastrados: number;
    contasComFalha: number;
    falhas2fa: number;
    senhasRedefinidas: number;
  };
  totalDownloads: number;
  topDownloads: { name: string; count: number }[];
}

export const PUBLICOS: { key: Publico; label: string }[] = [
  { key: "interno", label: "Colaboradores" },
  { key: "vpartner", label: "V-Partners" },
];

// Faixas pelo último login. A cor segue a rampa sequencial: quanto mais
// recente, mais forte; "nunca" fica fora da escala, no cinza neutro.
const FAIXAS: { key: Faixa; label: string }[] = [
  { key: "ativo30", label: "Últimos 30 dias" },
  { key: "ativo90", label: "Entre 30 e 90 dias" },
  { key: "inativo", label: "Há mais de 90 dias" },
  { key: "nunca", label: "Nunca acessou" },
];

// Colunas do mapa de calor: o expediente hora a hora; a madrugada e a noite,
// que quase não têm acesso, ficam agrupadas nas pontas.
const COLUNAS_HORA = [
  { rotulo: "<8", titulo: "antes das 8h", horas: [0, 1, 2, 3, 4, 5, 6, 7] },
  ...Array.from({ length: 11 }, (_, i) => ({
    rotulo: String(i + 8),
    titulo: `${i + 8}h`,
    horas: [i + 8],
  })),
  { rotulo: "19+", titulo: "a partir das 19h", horas: [19, 20, 21, 22, 23] },
];

const pct = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 100) : 0;

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

interface Props {
  stats: ActivityStats;
}

const ActivityCharts: React.FC<Props> = ({ stats }) => {
  const palette = useVizPalette();
  const baseOptions = useMemo<ChartOptions<any>>(
    () => opcoesBase(palette),
    [palette],
  );

  // `?? []`: um backend ainda sem os campos novos não derruba a tela.
  const serie = useMemo(() => stats.serie ?? [], [stats.serie]);
  const porSemana = stats.granularidade === "semana";
  const rotuloPeriodo = porSemana ? "por semana" : "por dia";

  // Título do tooltip: "Semana de 05/10" ou "Seg, 05/10"; o último ponto é o
  // período corrente, ainda incompleto.
  const tituloPonto = (i: number) => {
    const iso = serie[i]?.inicio;
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const texto = porSemana
      ? `Semana de ${shortDay(iso)}`
      : `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${shortDay(iso)}`;
    return i === serie.length - 1 ? `${texto} (em andamento)` : texto;
  };

  const opcoesLinha = useMemo<ChartOptions<any>>(
    () => ({
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        legend: legendStyle(palette),
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

  // ── 1. Usuários ativos ──
  const ativosData = useMemo(
    () => ({
      labels: serie.map((p) => shortDay(p.inicio)),
      datasets: [
        {
          label: "Colaboradores",
          data: serie.map((p) => p.internos),
          borderColor: palette.cat1,
          backgroundColor: `${palette.cat1}22`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: "V-Partners",
          data: serie.map((p) => p.vpartners),
          borderColor: palette.cat2,
          backgroundColor: `${palette.cat2}22`,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: false,
        },
      ],
    }),
    [serie, palette],
  );

  const ativosOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...opcoesLinha,
      plugins: {
        ...opcoesLinha.plugins,
        tooltip: {
          ...(opcoesLinha.plugins as any).tooltip,
          callbacks: {
            title: (items: any[]) => tituloPonto(items[0].dataIndex),
            label: (ctx: any) =>
              ` ${ctx.dataset.label}: ${ctx.raw} usuário${ctx.raw === 1 ? "" : "s"}`,
          },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opcoesLinha, serie, porSemana],
  );

  // ── 2. Adoção por público ──
  const [selecao, setSelecao] = useState<{ publico: Publico; faixa: Faixa } | null>(null);
  const corFaixa = (f: Faixa) =>
    ({
      ativo30: palette.seq[4],
      ativo90: palette.seq[2],
      inativo: palette.seq[0],
      nunca: palette.neutral,
    })[f];

  const alternar = (publico: Publico, faixa: Faixa) =>
    setSelecao((s) =>
      s && s.publico === publico && s.faixa === faixa ? null : { publico, faixa },
    );

  const listaSelecionada = useMemo(
    () =>
      selecao
        ? (stats.usuarios ?? []).filter(
            (u) => u.publico === selecao.publico && u.faixa === selecao.faixa,
          )
        : [],
    [selecao, stats.usuarios],
  );

  // ── 3. Mapa de calor (dia da semana x hora do login) ──
  const heatmap = useMemo(() => {
    const grid: number[][] = WEEKDAYS.map(() => COLUNAS_HORA.map(() => 0));
    (stats.porDiaHora ?? []).forEach((c) => {
      const col = COLUNAS_HORA.findIndex((k) => k.horas.includes(c.hora));
      if (grid[c.dow] && col >= 0) grid[c.dow][col] += c.count;
    });
    const max = Math.max(0, ...grid.flat());
    return { grid, max };
  }, [stats.porDiaHora]);

  const heatColor = (n: number) => {
    if (!heatmap.max || n === 0) return "var(--viz-empty)";
    // 5 degraus da rampa sequencial, proporcionais ao máximo.
    const step = Math.min(4, Math.floor((n / heatmap.max) * 5 - 0.0001));
    return palette.seq[Math.max(0, step)];
  };

  // ── 4. Saúde do acesso ──
  const acesso = stats.acesso;
  const tentativas = acesso ? acesso.sucesso + acesso.falhas : 0;

  const acessoData = useMemo(
    () => ({
      labels: serie.map((p) => shortDay(p.inicio)),
      datasets: [
        {
          label: "Logins concluídos",
          data: serie.map((p) => p.sucesso),
          borderColor: palette.neutral,
          backgroundColor: `${palette.neutral}22`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
        {
          label: "Senha incorreta",
          data: serie.map((p) => p.falhasSenha ?? p.falhas),
          borderColor: palette.seq[3],
          backgroundColor: `${palette.seq[3]}22`,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: false,
        },
        // Quem digitou um e-mail sem conta não "errou a senha": separado, o
        // gráfico não exagera o problema de senha.
        {
          label: "E-mail não cadastrado",
          data: serie.map((p) => p.falhasEmail ?? 0),
          borderColor: palette.seq[1],
          backgroundColor: `${palette.seq[1]}22`,
          borderWidth: 2,
          borderDash: [2, 3],
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: false,
        },
      ],
    }),
    [serie, palette],
  );

  const acessoOptions = useMemo<ChartOptions<any>>(
    () => ({
      ...opcoesLinha,
      plugins: {
        ...opcoesLinha.plugins,
        tooltip: {
          ...(opcoesLinha.plugins as any).tooltip,
          callbacks: {
            title: (items: any[]) => tituloPonto(items[0].dataIndex),
            footer: (items: any[]) => {
              const p = serie[items[0].dataIndex];
              if (!p) return "";
              const linhas = [`Senhas redefinidas: ${p.senhasRedefinidas}`];
              if (p.falhas2fa) linhas.push(`Código 2FA incorreto: ${p.falhas2fa}`);
              return linhas;
            },
          },
          footerColor: palette.textMuted,
          footerFont: { size: 11, weight: 500 },
        },
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opcoesLinha, serie, porSemana, palette],
  );

  const semLogins = serie.every((p) => p.sucesso === 0 && p.falhas === 0);

  // ── 5. Arquivos mais baixados ──
  // Barras relativas ao mais baixado (o 1º ocupa a trilha inteira); o % é a
  // fatia do total de downloads do período.
  const downloads = stats.topDownloads ?? [];
  const maxDownloads = Math.max(0, ...downloads.map((d) => d.count));

  return (
    <div className="viz-section">
      {/* ── Usuários ativos ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Usuários ativos</h3>
          <span className="viz-card-sub">
            usuários diferentes que entraram, {rotuloPeriodo}
          </span>
        </div>
        <div className="viz-canvas viz-canvas--tall">
          {serie.length ? (
            <Line data={ativosData} options={ativosOptions} />
          ) : (
            <p className="viz-empty">Sem dados.</p>
          )}
        </div>
      </div>

      {/* ── Adoção ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Adoção do Painel</h3>
          <span className="viz-card-sub">último acesso de cada usuário cadastrado</span>
        </div>

        {PUBLICOS.map(({ key, label }) => {
          const p = stats.publicos?.[key];
          if (!p) return null;
          return (
            <div key={key} className="viz-adocao">
              <div className="viz-adocao-head">
                <strong>{label}</strong>
                <span>
                  {p.cadastrados} cadastrado{p.cadastrados === 1 ? "" : "s"}
                </span>
              </div>
              {p.cadastrados === 0 ? (
                <p className="viz-empty">Nenhum usuário cadastrado.</p>
              ) : (
                <>
                  <div
                    className="viz-stack"
                    role="img"
                    aria-label={`${label}: ${FAIXAS.map(
                      (f) => `${f.label}: ${p.faixas[f.key]}`,
                    ).join(", ")}`}
                  >
                    {FAIXAS.filter((f) => p.faixas[f.key] > 0).map((f) => (
                      <span
                        key={f.key}
                        className="viz-stack-seg"
                        title={`${f.label}: ${p.faixas[f.key]} (${pct(p.faixas[f.key], p.cadastrados)}%)`}
                        style={
                          {
                            "--seg-w": `${(p.faixas[f.key] / p.cadastrados) * 100}%`,
                            "--seg-c": corFaixa(f.key),
                          } as React.CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <ul className="viz-legend">
                    {FAIXAS.map((f) => {
                      const ativo = selecao?.publico === key && selecao.faixa === f.key;
                      return (
                        <li key={f.key}>
                          <button
                            type="button"
                            className={`viz-legend-btn ${ativo ? "active" : ""}`}
                            aria-pressed={ativo}
                            disabled={p.faixas[f.key] === 0}
                            onClick={() => alternar(key, f.key)}
                            title={p.faixas[f.key] ? "Ver quem está nesta faixa" : undefined}
                          >
                            <span
                              className="viz-legend-dot"
                              style={{ "--seg-c": corFaixa(f.key) } as React.CSSProperties}
                            />
                            <span className="viz-legend-label">{f.label}</span>
                            <strong className="viz-legend-value">
                              {p.faixas[f.key]}
                            </strong>
                            <span className="viz-legend-pct">
                              {pct(p.faixas[f.key], p.cadastrados)}%
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          );
        })}

        {selecao && (
          <div className="viz-adocao-lista">
            <div className="viz-adocao-lista-head">
              <strong>
                {PUBLICOS.find((x) => x.key === selecao.publico)?.label} ·{" "}
                {FAIXAS.find((f) => f.key === selecao.faixa)?.label}
              </strong>
              <button
                type="button"
                className="form-button-cancel"
                onClick={() => setSelecao(null)}
              >
                Fechar
              </button>
            </div>
            <div className="table-container viz-adocao-tabela">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {listaSelecionada.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Nome">{u.nome}</td>
                      <td data-label="E-mail">{u.email}</td>
                      <td data-label="Último acesso">{dataCurta(u.ultimoLogin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Mapa de calor ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Quando o Painel é usado</h3>
          <span className="viz-card-sub">logins por dia da semana × hora</span>
        </div>

        {heatmap.max === 0 ? (
          <p className="viz-empty">Nenhum login no período.</p>
        ) : (
          <>
            <div className="viz-heat viz-heat--horas">
              <span />
              {COLUNAS_HORA.map((c) => (
                <span key={c.rotulo} className="viz-heat-col">
                  {c.rotulo}
                </span>
              ))}
              {WEEKDAYS.map((dia, d) => (
                <React.Fragment key={dia}>
                  <span className="viz-heat-row">{dia}</span>
                  {COLUNAS_HORA.map((c, b) => (
                    <span
                      key={c.rotulo}
                      className="viz-heat-cell"
                      title={`${dia}, ${c.titulo} — ${heatmap.grid[d][b]} login(s)`}
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

      {/* ── Saúde do acesso ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Saúde do acesso</h3>
          <span className="viz-card-sub">tentativas de login, {rotuloPeriodo}</span>
        </div>

        {acesso && (
          <ul className="viz-resumo">
            <li>
              <strong>{pct(acesso.falhasCadastrados, tentativas)}%</strong>
              <span>das tentativas com senha incorreta</span>
            </li>
            <li>
              <strong>{acesso.contasComFalha}</strong>
              <span>
                conta{acesso.contasComFalha === 1 ? "" : "s"} com erro de senha
              </span>
            </li>
            <li>
              <strong>{acesso.falhas - acesso.falhasCadastrados}</strong>
              <span>tentativas com e-mail não cadastrado</span>
            </li>
            <li>
              <strong>{acesso.senhasRedefinidas}</strong>
              <span>
                senha{acesso.senhasRedefinidas === 1 ? "" : "s"} redefinida
                {acesso.senhasRedefinidas === 1 ? "" : "s"}
              </span>
            </li>
          </ul>
        )}

        <div className="viz-canvas">
          {semLogins ? (
            <p className="viz-empty">Nenhuma tentativa de login no período.</p>
          ) : (
            <Line data={acessoData} options={acessoOptions} />
          )}
        </div>
      </div>

      {/* ── Arquivos mais baixados ── */}
      <div className="viz-card viz-card--wide">
        <div className="viz-card-head">
          <h3>Arquivos mais baixados</h3>
          <span className="viz-card-sub">
            {stats.totalDownloads
              ? `${stats.totalDownloads} download${stats.totalDownloads === 1 ? "" : "s"} no período`
              : "no período"}
          </span>
        </div>

        {downloads.length === 0 ? (
          <p className="viz-empty">Nenhum download no período.</p>
        ) : (
          <ol className="viz-ranking">
            {downloads.map((d, i) => (
              <li key={`${d.name}-${i}`} className="viz-ranking-item">
                <span className="viz-ranking-pos">{i + 1}</span>
                <span className="viz-ranking-icon" aria-hidden="true">
                  <HiOutlineDocumentText />
                </span>
                <div className="viz-ranking-body">
                  <div className="viz-ranking-top">
                    <span className="viz-ranking-name" title={d.name}>
                      {d.name}
                    </span>
                    <span className="viz-ranking-value">
                      <strong>{d.count}</strong>
                      <span>{pct(d.count, stats.totalDownloads)}%</span>
                    </span>
                  </div>
                  <div className="viz-ranking-track">
                    <span
                      className="viz-ranking-bar"
                      style={
                        {
                          "--bar-w": `${maxDownloads ? (d.count / maxDownloads) * 100 : 0}%`,
                          "--bar-c": palette.seq[2],
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default ActivityCharts;
