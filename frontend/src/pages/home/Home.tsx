import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import EmptyState from "../../components/ui/EmptyState.tsx";
import EventCard from "./EventCard.tsx";
import NoticeModal from "../../components/forms/NoticeModal.tsx";
import { IoMdDocument } from "react-icons/io";
import { MdPlayLesson, MdPlayCircle } from "react-icons/md";
import { RiQuestionnaireFill } from "react-icons/ri";
import { FaHeadset, FaArrowRight } from "react-icons/fa";

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "internos" | "licenciados";
  creator_name?: string;
}

interface MonthlyEvent {
  id: number;
  title: string;
  start_date: string;
  category: string;
  color: string;
}

interface QuickLink {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const Home: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.nome?.split(" ")[0] || "";
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchNotices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/notices", {
        params: { page: 1, limit: 10 },
      });
      setNotices(res.data.notices);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      toast.error("Não foi possível carregar os avisos.");
    }
  }, [user]);

  const fetchMonthlyEvents = useCallback(async () => {
    if (!user || user.role === "licenciado") return;
    try {
      const res = await api.get("/api/events/current-month");
      setMonthlyEvents(res.data);
    } catch (err) {
      console.error("Erro ao buscar eventos do mês:", err);
      toast.error("Não foi possível carregar os eventos do mês.");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotices();
      fetchMonthlyEvents();
    }
  }, [user, fetchNotices, fetchMonthlyEvents]);

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }
  if (!user) {
    return null;
  }

  const isLicenciado = user.role === "licenciado";
  const canManageNotices = user.role === "admin" || user.role === "rh";

  const quickLinks: QuickLink[] = [
    { label: "Documentos", icon: <IoMdDocument />, path: "/content/documentos" },
    { label: "Cursos", icon: <MdPlayLesson />, path: "/content/courses" },
    { label: "Vídeos", icon: <MdPlayCircle />, path: "/content/videos" },
    { label: "FAQ", icon: <RiQuestionnaireFill />, path: "/faq" },
  ];
  if (!isLicenciado) {
    quickLinks.push({
      label: "Meus Chamados",
      icon: <FaHeadset />,
      path: "/internal/meus-chamados",
    });
  }

  const latestNotice = notices[0];

  return (
    <div className="p-2 home-vision">
      <Menu />
      <div className="content-area">
        <div className="home-header">
          <h2 className="hello-user">Olá, {user.nickname || firstName}</h2>
          <p>Bem-vindo ao seu Painel da V-CORP.</p>
        </div>

        {/* Acesso rápido */}
        <section className="home-quick-access">
          <span className="home-section-label">Acesso rápido</span>
          <div className="home-quick-grid">
            {quickLinks.map((link) => (
              <button
                key={link.path}
                className="home-quick-tile"
                onClick={() => navigate(link.path)}
              >
                <span className="home-quick-tile-icon">{link.icon}</span>
                <span className="home-quick-tile-label">{link.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Colunas: eventos + aviso em destaque */}
        <div className="home-main-columns">
          {!isLicenciado && (
            <div className="home-elements events-column">
              <div className="home-col-head">
                <h3>Eventos do mês</h3>
              </div>
              <div className="events-grid">
                {monthlyEvents.length > 0 ? (
                  monthlyEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                ) : (
                  <EmptyState
                    imageKey="eventos"
                    title="Nenhum Evento Agendado"
                    message="Continue acompanhando para não perder os próximos eventos!"
                  />
                )}
              </div>
            </div>
          )}

          <div className="home-elements notices-column">
            <div className="home-notices-head home-col-head">
              <h3>Mural de avisos</h3>
              {canManageNotices && (
                <button
                  className="form-button form-button--add"
                  onClick={() => setIsNoticeModalOpen(true)}
                >
                  + Adicionar Aviso
                </button>
              )}
            </div>

            {latestNotice ? (
              <>
                <article className="home-notice-highlight">
                  <div
                    className="home-notice-preview"
                    dangerouslySetInnerHTML={{ __html: latestNotice.message }}
                  />
                  <div className="home-notice-meta">
                    {latestNotice.creator_name && (
                      <span className="notice-author-name">
                        {latestNotice.creator_name}
                      </span>
                    )}
                    <span>
                      {new Date(latestNotice.created_at).toLocaleDateString(
                        "pt-BR",
                        { day: "2-digit", month: "long", year: "numeric" },
                      )}
                    </span>
                  </div>
                  <button
                    className="home-notice-link"
                    onClick={() => navigate("/content/avisos")}
                  >
                    Ler comunicado completo <FaArrowRight aria-hidden="true" />
                  </button>
                </article>

                {notices.length > 1 && (
                  <button
                    className="home-notices-all"
                    onClick={() => navigate("/content/avisos")}
                  >
                    Ver todos os avisos
                  </button>
                )}
              </>
            ) : (
              <EmptyState
                imageKey="avisos"
                title="Nenhum Aviso no Momento"
                message="Não há avisos postados no momento. Verifique novamente mais tarde."
              />
            )}
          </div>
        </div>
      </div>

      <NoticeModal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        onSuccess={() => {
          fetchNotices();
        }}
        noticeToEdit={null}
      />
      <Footer />
    </div>
  );
};

export default Home;
