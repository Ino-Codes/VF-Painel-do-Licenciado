import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  HiOutlinePause,
} from "react-icons/hi";
import { FaHeadset } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";
import HelpdeskCharts from "./HelpdeskCharts.tsx";
import EnneagramStats from "./EnneagramStats.tsx";
import CourseEngagementDash from "./CourseEngagementDash.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

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
  byWeekdayPeriod: { dow: number; periodo: number; count: number }[];
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
  /** Mediana, em horas úteis, da abertura ao início do atendimento. */
  medianWaitHours: number | null;
  startedCount: number;
}


// Abas da tela. A aba aberta fica na URL (?aba=), para dar para linkar
// direto — o antigo /admin/dashboards redireciona para cá com ?aba=eneagrama.
const ABAS = [
  { key: "sistema", label: "Sistema" },
  { key: "chamados", label: "Central de Chamados" },
  { key: "eneagrama", label: "Eneagrama" },
  { key: "cursos", label: "Cursos" },
] as const;
type Aba = (typeof ABAS)[number]["key"];
const ehAba = (v: string | null): v is Aba => ABAS.some((a) => a.key === v);

const AdminStatistics: React.FC = () => {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const abaDaUrl = searchParams.get("aba");
  const activeTab: Aba = ehAba(abaDaUrl) ? abaDaUrl : "sistema";
  const setActiveTab = (aba: Aba) =>
    setSearchParams(aba === "sistema" ? {} : { aba }, { replace: true });

  // Eneagrama e Cursos buscam os próprios dados ao montar; "Atualizar"
  // remonta o painel trocando a key.
  const [versaoPainel, setVersaoPainel] = useState(0);

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
    else if (activeTab === "chamados") fetchTicketStats();
    else setVersaoPainel((v) => v + 1);
  };

  // Busca os dados uma vez ao entrar na aba. A partir daí a atualização é
  // sempre manual, pelo botão "Atualizar".
  useEffect(() => {
    if (!user) return;
    if (activeTab === "sistema") fetchStats();
    if (activeTab === "chamados") fetchTicketStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  if (loading || !user)
    return <LoadingSpinner />;

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

        <div className="tabs" role="tablist">
          {ABAS.map((aba) => (
            <button
              key={aba.key}
              role="tab"
              aria-selected={activeTab === aba.key}
              className={`tab-item ${activeTab === aba.key ? "active" : ""}`}
              onClick={() => setActiveTab(aba.key)}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {/* ───────────────────────── ABA: SISTEMA ───────────────────────── */}
        {activeTab === "sistema" &&
          (isLoadingData ? (
            <LoadingSpinner variant="inline" label="Carregando dados" />
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
            <LoadingSpinner variant="inline" label="Carregando dados" />
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
                    <HiOutlinePause />
                  </div>
                  <div className="stat-info">
                    <h3>{ticketStats.byStatus.pausado || 0}</h3>
                    <p>Pausados</p>
                  </div>
                </div>
                
              </div>

              <HelpdeskCharts stats={ticketStats} />
            </div>
          ) : (
            <p>Não foi possível carregar os dados.</p>
          ))}

        {/* ──────────────────────── ABA: ENEAGRAMA ──────────────────────── */}
        {activeTab === "eneagrama" && (
          <div className="stats-dashboard">
            <EnneagramStats key={`eneagrama-${versaoPainel}`} />
          </div>
        )}

        {/* ────────────────────────── ABA: CURSOS ────────────────────────── */}
        {activeTab === "cursos" && (
          <div className="stats-dashboard">
            <CourseEngagementDash key={`cursos-${versaoPainel}`} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminStatistics;
