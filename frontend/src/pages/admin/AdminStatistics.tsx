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
  HiOutlineStatusOnline,
  HiOutlineUserGroup,
  HiOutlineInbox,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlinePause,
  HiOutlineStar,
} from "react-icons/hi";
import { FaHeadset } from "react-icons/fa";
import { MdRefresh } from "react-icons/md";
import HelpdeskCharts, { HelpdeskSeries, formatNota } from "./HelpdeskCharts.tsx";
import ActivityCharts, { ActivityStats } from "./ActivityCharts.tsx";
import EnneagramStats from "./EnneagramStats.tsx";
import CourseEngagementDash from "./CourseEngagementDash.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

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
  rating?: HelpdeskSeries["rating"];
  ratingByAttendant?: HelpdeskSeries["ratingByAttendant"];
}


// Período da aba Atividade (o backend aceita os mesmos valores).
const PERIODOS = [
  { dias: 30, label: "Últimos 30 dias" },
  { dias: 90, label: "Últimos 90 dias" },
  { dias: 180, label: "Últimos 180 dias" },
];

// Abas da tela. A aba aberta fica na URL (?aba=), para dar para linkar
// direto — o antigo /admin/dashboards redireciona para cá com ?aba=eneagrama.
const ABAS = [
  { key: "atividade", label: "Atividade" },
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
  const activeTab: Aba = ehAba(abaDaUrl) ? abaDaUrl : "atividade";
  const setActiveTab = (aba: Aba) =>
    setSearchParams(aba === "atividade" ? {} : { aba }, { replace: true });

  // Eneagrama e Cursos buscam os próprios dados ao montar; "Atualizar"
  // remonta o painel trocando a key.
  const [versaoPainel, setVersaoPainel] = useState(0);

  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [dias, setDias] = useState(90);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  // Acesso é garantido centralmente pelo ProtectedRoute (analytics.view).

  const fetchStats = async () => {
    setIsLoadingData(true);
    try {
      const res = await api.get("/api/admin/analytics/system-usage", {
        params: { dias },
      });
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
    if (activeTab === "atividade") fetchStats();
    else if (activeTab === "chamados") fetchTicketStats();
    else setVersaoPainel((v) => v + 1);
  };

  // Busca os dados uma vez ao entrar na aba. A partir daí a atualização é
  // sempre manual, pelo botão "Atualizar".
  useEffect(() => {
    if (!user) return;
    if (activeTab === "atividade") fetchStats();
    if (activeTab === "chamados") fetchTicketStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab, dias]);

  if (loading || !user)
    return <LoadingSpinner />;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Estatísticas do Painel</h2>
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

        {/* ───────────────────────── ABA: ATIVIDADE ────────────────────── */}
        {activeTab === "atividade" && (
          <>
            <div className="page-filters stats-filtros">
              <div className="filter-group">
                <label className="filter-label" htmlFor="atividade-periodo">
                  Período
                </label>
                <select
                  id="atividade-periodo"
                  className="form-select"
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                >
                  {PERIODOS.map((p) => (
                    <option key={p.dias} value={p.dias}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoadingData ? (
              <LoadingSpinner variant="inline" label="Carregando dados" />
            ) : stats?.publicos ? (
              <div className="stats-dashboard">
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">
                      <HiOutlineStatusOnline />
                    </div>
                    <div className="stat-info">
                      <h3>
                        {stats.publicos.interno.ativos7 +
                          stats.publicos.vpartner.ativos7}
                      </h3>
                      <p>Ativos nos últimos 7 dias</p>
                      <span className="stat-sub">
                        de{" "}
                        {stats.publicos.interno.cadastrados +
                          stats.publicos.vpartner.cadastrados}{" "}
                        usuários cadastrados
                      </span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <HiOutlineUsers />
                    </div>
                    <div className="stat-info">
                      <h3>{stats.publicos.interno.cadastrados}</h3>
                      <p>Colaboradores cadastrados</p>
                      <span className="stat-sub">
                        {stats.publicos.interno.ativosPeriodo} ativos nos últimos{" "}
                        {stats.dias} dias
                      </span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <HiOutlineUserGroup />
                    </div>
                    <div className="stat-info">
                      <h3>{stats.publicos.vpartner.cadastrados}</h3>
                      <p>V-Partners cadastrados</p>
                      <span className="stat-sub">
                        {stats.publicos.vpartner.ativosPeriodo} ativos nos últimos{" "}
                        {stats.dias} dias
                      </span>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">
                      <HiOutlineDownload />
                    </div>
                    <div className="stat-info">
                      <h3>{stats.totalDownloads}</h3>
                      <p>Downloads realizados</p>
                      <span className="stat-sub">nos últimos {stats.dias} dias</span>
                    </div>
                  </div>
                </div>

                <ActivityCharts stats={stats} />
              </div>
            ) : (
              <p>Não foi possível carregar os dados.</p>
            )}
          </>
        )}

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

                {/* Média das avaliações dos solicitantes; a dica mostra a
                    taxa de resposta (concluídos que foram avaliados). */}
                <div
                  className="stat-card"
                  title={
                    ticketStats.rating && ticketStats.rating.concluidos
                      ? `${ticketStats.rating.total} de ${ticketStats.rating.concluidos} chamados concluídos foram avaliados (${Math.round(
                          (ticketStats.rating.total / ticketStats.rating.concluidos) * 100,
                        )}%).`
                      : undefined
                  }
                >
                  <div className="stat-icon">
                    <HiOutlineStar />
                  </div>
                  <div className="stat-info">
                    <h3>
                      {ticketStats.rating?.total
                        ? `${formatNota(ticketStats.rating.media)} / 5`
                        : "—"}
                    </h3>
                    <p>
                      Avaliação média
                    </p>
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
