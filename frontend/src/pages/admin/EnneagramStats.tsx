import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineUsers,
  HiOutlineSparkles,
  HiOutlineViewGrid,
  HiOutlineCalendar,
  HiOutlineChevronDown,
} from "react-icons/hi";
import api from "../../api.ts";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { useVizPalette } from "./vizShared.ts";

// ─── Formato dos dados (espelha o /api/admin/analytics/enneagram-stats) ─────

export interface EnneagramStatsData {
  tipos: { id: number; nome: string }[];
  /** Quantas vezes cada tipo (1 a 9) é oferecido nos pares do teste. */
  aparicoes: number[];
  participacao: { total: number; concluidos: number };
  ultimoTeste: string | null;
  setores: { setor: string; total: number; concluidos: number }[];
  resultados: {
    userId: number;
    nome: string;
    setor: string;
    tipo: number;
    /** Pontos de cada tipo, 1 a 9 (somam 20). */
    scores: number[];
    concluidoEm: string | null;
  }[];
  pendentes: { userId: number; nome: string; setor: string }[];
}

// Os três centros de inteligência do Eneagrama. Cada centro é uma identidade
// (não uma escala), por isso recebe uma cor categórica própria.
const CENTROS = [
  { key: "instintivo", label: "Instintivo", descricao: "ação e controle", tipos: [8, 9, 1] },
  { key: "emocional", label: "Emocional", descricao: "relações e imagem", tipos: [2, 3, 4] },
  { key: "mental", label: "Mental", descricao: "análise e segurança", tipos: [5, 6, 7] },
] as const;

type Situacao = "concluidos" | "pendentes" | "todos";

const pct = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 100) : 0;

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const diasDesde = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

/** % das vezes em que o tipo foi oferecido e a pessoa o escolheu. */
const afinidade = (pontos: number, vezes: number) =>
  vezes ? Math.round((pontos / vezes) * 100) : 0;

const EnneagramStats: React.FC = () => {
  const palette = useVizPalette();
  const [stats, setStats] = useState<EnneagramStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filtros da lista de pessoas.
  const [situacao, setSituacao] = useState<Situacao>("concluidos");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(0);
  const [aberto, setAberto] = useState<number | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get("/api/admin/analytics/enneagram-stats")
      .then((res) => {
        // Backend ainda na versão antiga (outro formato de resposta): trata
        // como falha em vez de quebrar a página inteira.
        if (!res.data?.participacao) {
          throw new Error("Resposta do Eneagrama em formato desconhecido.");
        }
        setStats(res.data);
        setLoadError(false);
      })
      .catch((err) => {
        setLoadError(true);
        console.error("Erro ao carregar dados do Eneagrama", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const nomeTipo = useMemo(() => {
    const mapa: Record<number, string> = {};
    (stats?.tipos ?? []).forEach((t) => (mapa[t.id] = t.nome));
    return (id: number) => mapa[id] || `Tipo ${id}`;
  }, [stats?.tipos]);

  const resultados = useMemo(() => stats?.resultados ?? [], [stats?.resultados]);

  // Quantas pessoas têm cada tipo como dominante (índice 0 = tipo 1).
  const porTipo = useMemo(() => {
    const c = Array(9).fill(0);
    resultados.forEach((r) => {
      if (r.tipo >= 1 && r.tipo <= 9) c[r.tipo - 1]++;
    });
    return c as number[];
  }, [resultados]);

  // Afinidade média da equipe com cada tipo.
  const perfilMedio = useMemo(() => {
    const vezes = stats?.aparicoes ?? [];
    return Array.from({ length: 9 }, (_, i) =>
      resultados.length
        ? Math.round(
            resultados.reduce((acc, r) => acc + afinidade(r.scores[i] ?? 0, vezes[i] ?? 0), 0) /
              resultados.length,
          )
        : 0,
    );
  }, [resultados, stats?.aparicoes]);

  const lista = useMemo(() => {
    if (!stats) return [];
    const concluidos = resultados.map((r) => ({ ...r, concluido: true as const }));
    const pendentes = (stats.pendentes ?? []).map((p) => ({ ...p, concluido: false as const }));
    const base =
      situacao === "concluidos"
        ? concluidos
        : situacao === "pendentes"
          ? pendentes
          : [...concluidos, ...pendentes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return base.filter(
      (p) =>
        (!filtroSetor || p.setor === filtroSetor) &&
        (!filtroTipo || (p.concluido && p.tipo === filtroTipo)),
    );
  }, [stats, resultados, situacao, filtroSetor, filtroTipo]);

  if (loading) return <LoadingSpinner variant="inline" label="Carregando dados" />;

  if (loadError || !stats) {
    return (
      <p className="tela-loading">
        Não foi possível carregar os dados. Tente novamente mais tarde.
      </p>
    );
  }

  const { participacao } = stats;
  const maxTipo = Math.max(0, ...porTipo);
  const maisComuns = maxTipo
    ? porTipo.map((n, i) => (n === maxTipo ? i + 1 : 0)).filter(Boolean)
    : [];
  const presentes = porTipo.filter((n) => n > 0).length;
  const ausentes = porTipo.map((n, i) => (n === 0 ? i + 1 : 0)).filter(Boolean);

  const centros = CENTROS.map((c, i) => ({
    ...c,
    count: c.tipos.reduce((acc, t) => acc + porTipo[t - 1], 0),
    cor: [palette.cat1, palette.cat2, palette.seq[2]][i],
  }));

  // Clicar num setor leva para a lista já filtrada: quem falta fazer ou, se o
  // setor já completou, quem fez.
  const verSetor = (setor: string, temPendentes: boolean) => {
    setFiltroSetor(setor);
    setFiltroTipo(0);
    setSituacao(temPendentes ? "pendentes" : "concluidos");
    setAberto(null);
    listaRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const verTipo = (tipo: number) => {
    setFiltroTipo(tipo);
    setFiltroSetor("");
    setSituacao("concluidos");
    setAberto(null);
    listaRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineUsers />
          </div>
          <div className="stat-info">
            <h3>
              {participacao.concluidos} de {participacao.total}
            </h3>
            <p>Fizeram o teste</p>
            <span className="stat-sub">
              {pct(participacao.concluidos, participacao.total)}% de quem tem acesso
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineSparkles />
          </div>
          <div className="stat-info">
            <h3 className="stat-text">
              {maisComuns.length ? maisComuns.map(nomeTipo).join(" e ") : "—"}
            </h3>
            <p>Perfil mais comum</p>
            {maxTipo > 0 && (
              <span className="stat-sub">
                {maxTipo} pessoa{maxTipo === 1 ? "" : "s"}
                {maisComuns.length > 1 ? " cada" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineViewGrid />
          </div>
          <div className="stat-info">
            <h3>{presentes} de 9</h3>
            <p>Tipos presentes na equipe</p>
            {resultados.length > 0 && ausentes.length > 0 && (
              <span className="stat-sub">sem ninguém: tipos {ausentes.join(", ")}</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <HiOutlineCalendar />
          </div>
          <div className="stat-info">
            <h3>{dataCurta(stats.ultimoTeste)}</h3>
            <p>Último teste concluído</p>
            {stats.ultimoTeste && (
              <span className="stat-sub">
                há {diasDesde(stats.ultimoTeste)} dia
                {diasDesde(stats.ultimoTeste) === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="viz-section">
        {/* ── Distribuição por tipo ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Distribuição por tipo</h3>
            <span className="viz-card-sub">tipo dominante de cada pessoa</span>
          </div>
          {resultados.length === 0 ? (
            <p className="viz-empty">Ninguém fez o teste ainda.</p>
          ) : (
            <ul className="viz-barras">
              {porTipo.map((n, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`viz-barras-row ${n === 0 ? "vazio" : ""}`}
                    disabled={n === 0}
                    onClick={() => verTipo(i + 1)}
                    title={n ? `Ver quem é ${nomeTipo(i + 1)}` : undefined}
                  >
                    <span className="viz-barras-label">
                      <span className="viz-barras-num">{i + 1}</span>
                      {nomeTipo(i + 1)}
                    </span>
                    <span className="viz-ranking-track">
                      <span
                        className="viz-ranking-bar"
                        style={
                          {
                            "--bar-w": `${maxTipo ? (n / maxTipo) * 100 : 0}%`,
                            "--bar-c": palette.seq[2],
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="viz-barras-value">
                      <strong>{n}</strong>
                      <span>{pct(n, resultados.length)}%</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Centros de inteligência ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Centros de inteligência</h3>
            <span className="viz-card-sub">como a equipe tende a reagir</span>
          </div>
          {resultados.length === 0 ? (
            <p className="viz-empty">Ninguém fez o teste ainda.</p>
          ) : (
            <>
              <div
                className="viz-stack"
                role="img"
                aria-label={centros.map((c) => `${c.label}: ${c.count}`).join(", ")}
              >
                {centros
                  .filter((c) => c.count > 0)
                  .map((c) => (
                    <span
                      key={c.key}
                      className="viz-stack-seg"
                      title={`${c.label}: ${c.count} (${pct(c.count, resultados.length)}%)`}
                      style={
                        {
                          "--seg-w": `${(c.count / resultados.length) * 100}%`,
                          "--seg-c": c.cor,
                        } as React.CSSProperties
                      }
                    />
                  ))}
              </div>
              <ul className="viz-centros">
                {centros.map((c) => (
                  <li key={c.key}>
                    <span
                      className="viz-legend-dot"
                      style={{ "--seg-c": c.cor } as React.CSSProperties}
                    />
                    <div>
                      <div className="viz-centros-top">
                        <strong>{c.label}</strong>
                        <span className="viz-centros-valor">
                          {c.count} · {pct(c.count, resultados.length)}%
                        </span>
                      </div>
                      <span className="viz-centros-desc">
                        {c.descricao} · tipos {c.tipos.join(", ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── Perfil médio ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Perfil médio da equipe</h3>
            <span className="viz-card-sub">afinidade com cada tipo</span>
          </div>
          {resultados.length === 0 ? (
            <p className="viz-empty">Ninguém fez o teste ainda.</p>
          ) : (
            <>
              <ul className="viz-barras">
                {perfilMedio.map((v, i) => (
                  <li key={i}>
                    <div className="viz-barras-row">
                      <span className="viz-barras-label">
                        <span className="viz-barras-num">{i + 1}</span>
                        {nomeTipo(i + 1)}
                      </span>
                      <span className="viz-ranking-track">
                        <span
                          className="viz-ranking-bar"
                          style={
                            {
                              "--bar-w": `${v}%`,
                              "--bar-c": palette.seq[2],
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      <span className="viz-barras-value">
                        <strong>{v}%</strong>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="viz-nota">
                Em média, quantas vezes cada tipo foi escolhido quando apareceu
                no teste. Mostra as tendências secundárias, não só o tipo
                dominante.
              </p>
            </>
          )}
        </div>

        {/* ── Participação por setor ── */}
        <div className="viz-card">
          <div className="viz-card-head">
            <h3>Participação por setor</h3>
            <span className="viz-card-sub">clique para ver quem falta</span>
          </div>
          {(stats.setores ?? []).length === 0 ? (
            <p className="viz-empty">Sem dados.</p>
          ) : (
            <ul className="viz-barras">
              {stats.setores.map((s) => (
                <li key={s.setor}>
                  <button
                    type="button"
                    className="viz-barras-row"
                    onClick={() => verSetor(s.setor, s.concluidos < s.total)}
                    title={
                      s.concluidos < s.total
                        ? `Ver quem falta em ${s.setor}`
                        : `Ver resultados de ${s.setor}`
                    }
                  >
                    <span className="viz-barras-label">{s.setor}</span>
                    <span className="viz-ranking-track">
                      <span
                        className="viz-ranking-bar"
                        style={
                          {
                            "--bar-w": `${pct(s.concluidos, s.total)}%`,
                            "--bar-c": palette.seq[2],
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="viz-barras-value">
                      <strong>
                        {s.concluidos} de {s.total}
                      </strong>
                      <span>{pct(s.concluidos, s.total)}%</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Pessoas ── */}
        <div className="viz-card viz-card--wide" ref={listaRef}>
          <div className="viz-card-head">
            <h3>Pessoas</h3>
            <span className="viz-card-sub">
              {lista.length} pessoa{lista.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="page-filters stats-filtros">
            <div className="filter-group">
              <label className="filter-label" htmlFor="enea-situacao">
                Situação
              </label>
              <select
                id="enea-situacao"
                className="form-select"
                value={situacao}
                onChange={(e) => {
                  setSituacao(e.target.value as Situacao);
                  setAberto(null);
                }}
              >
                <option value="concluidos">Fizeram o teste</option>
                <option value="pendentes">Ainda não fizeram</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label" htmlFor="enea-setor">
                Setor
              </label>
              <select
                id="enea-setor"
                className="form-select"
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {(stats.setores ?? []).map((s) => (
                  <option key={s.setor} value={s.setor}>
                    {s.setor}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label" htmlFor="enea-tipo">
                Tipo
              </label>
              <select
                id="enea-tipo"
                className="form-select"
                value={filtroTipo}
                disabled={situacao === "pendentes"}
                onChange={(e) => setFiltroTipo(Number(e.target.value))}
              >
                <option value={0}>Todos os tipos</option>
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1} · {nomeTipo(i + 1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {lista.length === 0 ? (
            <p className="viz-empty">Ninguém com esses filtros.</p>
          ) : (
            <div className="table-container">
              <table className="admin-table enea-tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Setor</th>
                    <th>Tipo dominante</th>
                    <th>Concluído em</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const expandido = p.concluido && aberto === p.userId;
                    return (
                      <React.Fragment key={p.userId}>
                        <tr className={expandido ? "enea-linha-aberta" : undefined}>
                          <td data-label="Nome">
                            {p.concluido ? (
                              <button
                                type="button"
                                className="enea-nome-btn"
                                aria-expanded={expandido}
                                onClick={() => setAberto(expandido ? null : p.userId)}
                              >
                                <HiOutlineChevronDown
                                  className={`enea-chevron ${expandido ? "aberto" : ""}`}
                                />
                                {p.nome}
                              </button>
                            ) : (
                              p.nome
                            )}
                          </td>
                          <td data-label="Setor">{p.setor}</td>
                          <td data-label="Tipo dominante">
                            {p.concluido ? (
                              `${p.tipo} · ${nomeTipo(p.tipo)}`
                            ) : (
                              <span className="enea-pendente">Ainda não fez</span>
                            )}
                          </td>
                          <td data-label="Concluído em">
                            {p.concluido ? dataCurta(p.concluidoEm) : "—"}
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="enea-detalhe">
                            <td colSpan={4}>
                              <ul className="viz-barras viz-barras--compacto">
                                {p.scores.map((pontos, i) => {
                                  const v = afinidade(pontos, stats.aparicoes[i] ?? 0);
                                  return (
                                    <li key={i}>
                                      <div className="viz-barras-row">
                                        <span className="viz-barras-label">
                                          <span className="viz-barras-num">{i + 1}</span>
                                          {nomeTipo(i + 1)}
                                        </span>
                                        <span className="viz-ranking-track">
                                          <span
                                            className="viz-ranking-bar"
                                            style={
                                              {
                                                "--bar-w": `${v}%`,
                                                "--bar-c":
                                                  i + 1 === p.tipo ? palette.seq[4] : palette.seq[1],
                                              } as React.CSSProperties
                                            }
                                          />
                                        </span>
                                        <span className="viz-barras-value">
                                          <strong>{v}%</strong>
                                          <span>
                                            {pontos} de {stats.aparicoes[i] ?? 0}
                                          </span>
                                        </span>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EnneagramStats;
