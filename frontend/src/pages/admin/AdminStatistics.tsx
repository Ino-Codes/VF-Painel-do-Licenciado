import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import {
  HiOutlineUsers,
  HiOutlineDownload,
  HiOutlineDocumentText,
  HiOutlineStatusOnline,
  HiOutlineInbox,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineCalendar,
  HiOutlineViewBoards,
  HiOutlineFlag,
  HiOutlineExternalLink,
} from "react-icons/hi";
import { FaHeadset, FaJira } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";

interface SystemStats {
  todayLogins: number;
  totalInternalUsers: number;
  totalLicenciados: number;
  totalDownloads: number;
  topDownloads: { name: string; count: number }[];
}

interface JiraStats {
  configured: boolean;
  projectKey?: string;
  boardUrl?: string;
  sprint?: {
    name: string;
    goal: string;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number | null;
  } | null;
  total?: number;
  byCategory?: { todo: number; inProgress: number; done: number };
  byStatus?: { name: string; count: number; category: string }[];
  byType?: { type: string; count: number }[];
  byAssignee?: {
    name: string;
    avatarUrl: string | null;
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  }[];
  avgCompletionHours?: number | null;
  resolvedCount?: number;
  updatedAt?: string;
}

interface TicketStats {
  total: number;
  byStatus: Record<string, number>;
  byType: { type: string; count: number }[];
  bySystem: { name: string; count: number }[];
  openedToday: number;
  opened7d: number;
  opened30d: number;
  avgResolutionHours: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
  duvida: "Dúvida",
  solicitacao: "Solicitação",
  sugestao_melhoria: "Sugestão (melhoria)",
};

const formatHours = (h: number | null): string => {
  if (h === null || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} h`;
  const d = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return `${d}d ${rem}h`;
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Rótulo e cor (via classe) de cada categoria do quadro
const CATEGORY_LABEL: Record<string, string> = {
  todo: "A fazer",
  inProgress: "Em andamento",
  done: "Concluído",
};

const AdminStatistics: React.FC = () => {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "sistema" | "chamados" | "jira"
  >("sistema");

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const [jiraStats, setJiraStats] = useState<JiraStats | null>(null);
  const [isLoadingJira, setIsLoadingJira] = useState(true);

  // Acesso é garantido centralmente pelo ProtectedRoute (analytics.view).

  const fetchStats = async () => {
    setIsLoadingData(true);
    try {
      const res = await api.get("/api/admin/analytics/system-usage");
      setStats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar estatísticas.");
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchTicketStats = async () => {
    setIsLoadingTickets(true);
    try {
      const res = await api.get("/api/admin/analytics/helpdesk");
      setTicketStats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar estatísticas de chamados.");
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchJiraStats = async () => {
    setIsLoadingJira(true);
    try {
      const res = await api.get("/api/admin/analytics/jira");
      setJiraStats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar estatísticas do Jira.");
    } finally {
      setIsLoadingJira(false);
    }
  };

  const refreshActive = () => {
    if (activeTab === "sistema") fetchStats();
    else if (activeTab === "chamados") fetchTicketStats();
    else fetchJiraStats();
  };

  // Busca os dados da aba ativa (e atualiza a cada 60s para efeito "ao vivo").
  useEffect(() => {
    if (!user) return;
    refreshActive();
    const interval = setInterval(refreshActive, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Estatísticas do Sistema</h2>
          <button className="form-icon-edit" onClick={refreshActive}>
            <MdRefresh /> Atualizar
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "sistema" ? "active" : ""}`}
            onClick={() => setActiveTab("sistema")}
          >
            Sistema
          </button>
          <button
            className={`tab-item ${activeTab === "chamados" ? "active" : ""}`}
            onClick={() => setActiveTab("chamados")}
          >
            Central de Chamados
          </button>
          <button
            className={`tab-item ${activeTab === "jira" ? "active" : ""}`}
            onClick={() => setActiveTab("jira")}
          >
            Desenvolvimento
          </button>
        </div>

        {/* ───────────────────────── ABA: SISTEMA ───────────────────────── */}
        {activeTab === "sistema" &&
          (isLoadingData ? (
            <div className="tela-loading stats-loading-box">
              Carregando dados...
            </div>
          ) : stats ? (
            <div className="stats-dashboard">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineStatusOnline />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.todayLogins}</h3>
                    <p>Logins Hoje</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineDownload />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.totalDownloads}</h3>
                    <p>Downloads Realizados</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineUsers />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.totalLicenciados}</h3>
                    <p>V-Partners Cadastrados</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineUsers />
                  </div>
                  <div className="stat-info">
                    <h3>{stats.totalInternalUsers}</h3>
                    <p>Colaboradores Cadastrados</p>
                  </div>
                </div>
              </div>

              <div className="admin-section">
                <h3>Arquivos Mais Baixados</h3>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nome do Arquivo</th>
                        <th className="stats-th-center">Qtd. Downloads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topDownloads.map((file, index) => (
                        <tr key={index}>
                          <td className="file-cell">
                            <HiOutlineDocumentText
                              size={20}
                              color="var(--text-secondary)"
                            />
                            {file.name}
                          </td>
                          <td className="stats-count-cell">
                            <span className="count-badge">{file.count}</span>
                          </td>
                        </tr>
                      ))}
                      {stats.topDownloads.length === 0 && (
                        <tr>
                          <td colSpan={2} className="stats-empty-cell">
                            Nenhum download registrado ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p>Não foi possível carregar os dados.</p>
          ))}

        {/* ──────────────────── ABA: CENTRAL DE CHAMADOS ──────────────────── */}
        {activeTab === "chamados" &&
          (isLoadingTickets ? (
            <div className="tela-loading stats-loading-box">
              Carregando dados...
            </div>
          ) : ticketStats ? (
            <div className="stats-dashboard">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaHeadset />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.total}</h3>
                    <p>Total de Chamados</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineInbox />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.byStatus.novo || 0}</h3>
                    <p>Novos (na fila)</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineClock />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.byStatus.andamento || 0}</h3>
                    <p>Em Atendimento</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineCheckCircle />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.byStatus.concluido || 0}</h3>
                    <p>Concluídos</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineStatusOnline />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.openedToday}</h3>
                    <p>Abertos Hoje</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineCalendar />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.opened7d}</h3>
                    <p>Abertos (7 dias)</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineCalendar />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.opened30d}</h3>
                    <p>Abertos (30 dias)</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineClock />
                  </div>
                  <div className="stat-info">
                    <h3>{formatHours(ticketStats.avgResolutionHours)}</h3>
                    <p>Tempo Médio de Resolução</p>
                  </div>
                </div>
              </div>

              <div className="admin-section">
                <h3>Chamados por Sistema</h3>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Sistema</th>
                        <th className="stats-th-center">Qtd. Chamados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketStats.bySystem.map((row, index) => (
                        <tr key={index}>
                          <td className="file-cell">{row.name}</td>
                          <td className="stats-count-cell">
                            <span className="count-badge">{row.count}</span>
                          </td>
                        </tr>
                      ))}
                      {ticketStats.bySystem.length === 0 && (
                        <tr>
                          <td colSpan={2} className="stats-empty-cell">
                            Nenhum chamado registrado ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-section">
                <h3>Chamados por Tipo</h3>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th className="stats-th-center">Qtd. Chamados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketStats.byType.map((row, index) => (
                        <tr key={index}>
                          <td className="file-cell">
                            {TYPE_LABELS[row.type] || row.type}
                          </td>
                          <td className="stats-count-cell">
                            <span className="count-badge">{row.count}</span>
                          </td>
                        </tr>
                      ))}
                      {ticketStats.byType.length === 0 && (
                        <tr>
                          <td colSpan={2} className="stats-empty-cell">
                            Nenhum chamado registrado ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p>Não foi possível carregar os dados.</p>
          ))}

        {/* ───────────────────── ABA: DESENVOLVIMENTO (JIRA) ───────────────────── */}
        {activeTab === "jira" &&
          (isLoadingJira ? (
            <div className="tela-loading stats-loading-box">
              Carregando dados...
            </div>
          ) : jiraStats && jiraStats.configured === false ? (
            <div className="on-screen-form jira-not-configured">
              <FaJira size={40} color="var(--brand-gold)" />
              <h3>Integração com o Jira não configurada</h3>
              <p>
                Defina as variáveis de ambiente <code>JIRA_EMAIL</code> e{" "}
                <code>JIRA_API_TOKEN</code> no servidor para exibir as
                estatísticas de desenvolvimento aqui.
              </p>
            </div>
          ) : jiraStats && jiraStats.configured ? (
            <div className="stats-dashboard">
              {/* Cabeçalho da sprint atual */}
              {jiraStats.sprint && (
                <div className="jira-sprint-card">
                  <div className="jira-sprint-head">
                    <div>
                      <span className="jira-sprint-eyebrow">
                        <HiOutlineViewBoards /> Sprint atual
                      </span>
                      <h3>{jiraStats.sprint.name}</h3>
                      {jiraStats.sprint.goal && (
                        <p className="jira-sprint-goal">
                          <HiOutlineFlag /> {jiraStats.sprint.goal}
                        </p>
                      )}
                    </div>
                    {jiraStats.boardUrl && (
                      <a
                        className="jira-board-link"
                        href={jiraStats.boardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir no Jira <HiOutlineExternalLink />
                      </a>
                    )}
                  </div>

                  <div className="jira-sprint-meta">
                    <span>
                      <HiOutlineCalendar /> Conclusão em{" "}
                      <strong>{formatDate(jiraStats.sprint.endDate)}</strong>
                      {jiraStats.sprint.daysRemaining !== null &&
                        (jiraStats.sprint.daysRemaining >= 0 ? (
                          <em> ({jiraStats.sprint.daysRemaining} dias restantes)</em>
                        ) : (
                          <em> (encerrada)</em>
                        ))}
                    </span>
                  </div>

                  {/* Progresso: concluídos / total */}
                  <div className="jira-progress-track">
                    <div
                      className="jira-progress-fill"
                      style={
                        {
                          "--bar-width": `${
                            jiraStats.total
                              ? Math.round(
                                  ((jiraStats.byCategory?.done || 0) /
                                    jiraStats.total) *
                                    100,
                                )
                              : 0
                          }%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span className="jira-progress-label">
                    {jiraStats.byCategory?.done || 0} de {jiraStats.total || 0}{" "}
                    cards concluídos
                  </span>
                </div>
              )}

              {/* Cartões de resumo */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <FaJira />
                  </div>
                  <div className="stat-info">
                    <h3>{jiraStats.total || 0}</h3>
                    <p>Cards na Sprint</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineInbox />
                  </div>
                  <div className="stat-info">
                    <h3>{jiraStats.byCategory?.todo || 0}</h3>
                    <p>A Fazer</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineClock />
                  </div>
                  <div className="stat-info">
                    <h3>{jiraStats.byCategory?.inProgress || 0}</h3>
                    <p>Em Andamento</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineCheckCircle />
                  </div>
                  <div className="stat-info">
                    <h3>{jiraStats.byCategory?.done || 0}</h3>
                    <p>Concluídos</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">
                    <HiOutlineClock />
                  </div>
                  <div className="stat-info">
                    <h3>{formatHours(jiraStats.avgCompletionHours ?? null)}</h3>
                    <p>Tempo Médio de Conclusão (90d)</p>
                  </div>
                </div>
              </div>

              {/* Gráfico: cards por status */}
              <div className="admin-section">
                <h3>Cards por Status</h3>
                <div className="chart-container-stats">
                  {jiraStats.byStatus && jiraStats.byStatus.length ? (
                    jiraStats.byStatus.map((s, i) => {
                      const max = Math.max(
                        ...jiraStats.byStatus!.map((x) => x.count),
                        1,
                      );
                      return (
                        <div className="jira-bar-row" key={i}>
                          <span className="jira-bar-label">{s.name}</span>
                          <span className="jira-bar-track">
                            <span
                              className={`jira-bar-fill cat-${s.category}`}
                              style={
                                {
                                  "--bar-width": `${Math.round(
                                    (s.count / max) * 100,
                                  )}%`,
                                } as React.CSSProperties
                              }
                            />
                          </span>
                          <span className="jira-bar-value">{s.count}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="stats-empty-cell">Sem cards na sprint.</p>
                  )}
                </div>
              </div>

              {/* Tabela/gráfico: cards por desenvolvedor */}
              <div className="admin-section">
                <h3>Cards por Desenvolvedor</h3>
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Desenvolvedor</th>
                        <th className="stats-th-center">A fazer</th>
                        <th className="stats-th-center">Em andamento</th>
                        <th className="stats-th-center">Concluídos</th>
                        <th className="stats-th-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jiraStats.byAssignee &&
                        jiraStats.byAssignee.map((dev, i) => (
                          <tr key={i}>
                            <td className="file-cell">
                              {dev.avatarUrl ? (
                                <img
                                  className="jira-dev-avatar"
                                  src={dev.avatarUrl}
                                  alt={dev.name}
                                />
                              ) : (
                                <HiOutlineUsers
                                  size={20}
                                  color="var(--text-secondary)"
                                />
                              )}
                              {dev.name}
                            </td>
                            <td className="stats-count-cell">{dev.todo}</td>
                            <td className="stats-count-cell">
                              {dev.inProgress}
                            </td>
                            <td className="stats-count-cell">{dev.done}</td>
                            <td className="stats-count-cell">
                              <span className="count-badge">{dev.total}</span>
                            </td>
                          </tr>
                        ))}
                      {(!jiraStats.byAssignee ||
                        jiraStats.byAssignee.length === 0) && (
                        <tr>
                          <td colSpan={5} className="stats-empty-cell">
                            Nenhum card atribuído na sprint.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p>Não foi possível carregar os dados.</p>
          ))}
      </div>
      <Footer />
    </div>
  );
};

export default AdminStatistics;
