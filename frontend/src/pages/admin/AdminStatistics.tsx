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
} from "react-icons/hi";
import { FaHeadset } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";
import HelpdeskCharts from "./HelpdeskCharts.tsx";

interface SystemStats {
  todayLogins: number;
  totalInternalUsers: number;
  totalLicenciados: number;
  totalDownloads: number;
  topDownloads: { name: string; count: number }[];
}


interface TicketStats {
  total: number;
  byStatus: Record<string, number>;
  byType: { type: string; count: number }[];
  bySystem: { name: string; count: number }[];
  daily: { dia: string; abertos: number; concluidos: number }[];
  byWeekdayHour: { dow: number; bloco: number; count: number }[];
  monthly: { mes: string; horas: number | null; concluidos: number }[];
  byAttendant: { name: string; count: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  help: "Ajuda",
  bug: "Bug",
  suggestion: "Sugestão",
  duvida: "Dúvida",
  solicitacao: "Solicitação",
  sugestao_melhoria: "Sugestão (melhoria)",
};


const AdminStatistics: React.FC = () => {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "sistema" | "chamados"
  >("sistema");

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

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


  const refreshActive = () => {
    if (activeTab === "sistema") fetchStats();
    else fetchTicketStats();
  };

  // Busca os dados uma vez ao entrar na aba. A partir daí a atualização é
  // sempre manual, pelo botão "Atualizar".
  useEffect(() => {
    if (!user) return;
    refreshActive();
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
              </div>

              <HelpdeskCharts stats={ticketStats} />

              {/* As tabelas abaixo são a leitura textual dos gráficos —
                  garantem os números exatos e a acessibilidade. */}
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

      </div>
      <Footer />
    </div>
  );
};

export default AdminStatistics;
