import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import EventCard from "./EventCard.tsx";
import EnneagramStats from "./EnneagramStats.tsx";
import NoticeModal from "../../components/forms/NoticeModal.tsx";
import { TiptapMenuBar } from "../../components/editor/TiptapEditor.tsx";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "internos" | "licenciados";
}

interface MonthlyEvent {
  id: number;
  title: string;
  start_date: string;
  category: string;
  color: string;
}

const CoursesAnalytics: React.FC = () => {
  return (
    <div>
      <h4>Análise de Cursos</h4>
      <EmptyState
        imageKey="dashs"
        title="Relatórios de Cursos em Desenvolvimento"
        message="Estamos criando gráficos sobre o progresso e engajamento nos cursos. Volte em breve!"
      />
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeToDelete, setNoticeToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeToEdit, setNoticeToEdit] = useState<Notice | null>(null);

  const [activeReportTab, setActiveReportTab] = useState(
    user?.role === "admin" ? "eneagrama" : "cursos"
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchNotices = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/notices");
      setNotices(res.data);
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

  const handleOpenCreateNotice = () => {
    setNoticeToEdit(null); // Garante que o modal abra no modo de criação
    setIsNoticeModalOpen(true);
  };

  const handleOpenEditNotice = (notice: Notice) => {
    setNoticeToEdit(notice); // Passa a notícia a ser editada
    setIsNoticeModalOpen(true);
  };

  const handleDeleteNoticeClick = (noticeId: number) => {
    setNoticeToDelete(noticeId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDeleteNotice = async () => {
    if (noticeToDelete === null) return;
    try {
      await api.delete(`/api/notices/admin/${noticeToDelete}`);
      toast.success("Aviso excluído com sucesso!");
      fetchNotices();
    } catch (err) {
      toast.error("Erro ao excluir o aviso.");
    } finally {
      setIsConfirmModalOpen(false);
      setNoticeToDelete(null);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (activeEditor) {
      activeEditor.chain().focus().insertContent(emojiData.emoji).run();
    }
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = (editor: Editor, event: React.MouseEvent) => {
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    setPickerPosition({
      top: rect.top,
      right: window.innerWidth - rect.right - 350, // 350 é a largura do picker
    });

    setActiveEditor(editor);
    setShowEmojiPicker((prev) => !prev);
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="dashboard-header">
          <h2>Bem-vindo(a), {user.nome}!</h2>
          <p>
            Este é o seu novo Painel da Valor Fiscal!
            <br />
            Aqui você encontra os principais documentos e treinamentos para
            atuar conosco.
          </p>
        </div>

        <div className="dashboard-main-columns">
          {user.role !== "licenciado" && (
            <div className="dashboard-elements events-column">
              <h3>Eventos do Mês</h3>
              <div className="events-grid">
                {monthlyEvents.length > 0 ? (
                  monthlyEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))
                ) : (
                  <EmptyState
                    imageKey="eventos"
                    title="Nenhum Evento Agendado"
                    message="Não há eventos agendados para este mês no momento. Verifique novamente mais tarde."
                  />
                )}
              </div>
            </div>
          )}
          <div className="dashboard-elements notices-column">
            <h3>Mural de Avisos</h3>
            <div className="notice-board">
              {user.role === "admin" && (
                <div className="notice-form-actions">
                  <button
                    className="form-button"
                    onClick={handleOpenCreateNotice}
                  >
                    + Adicionar Aviso
                  </button>
                </div>
              )}
            </div>
            <div className="notice-list">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <div key={notice.id} className="notice-card">
                    <>
                      <div
                        className="notice-message"
                        dangerouslySetInnerHTML={{ __html: notice.message }}
                      />
                      <div className="notice-footer">
                        <small>
                          {new Date(notice.created_at).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </small>
                        {user.role === "admin" && (
                          <div className="notice-actions">
                            <button
                              className="list-button"
                              onClick={() => handleOpenEditNotice(notice)}
                            >
                              Editar
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteNoticeClick(notice.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  </div>
                ))
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

        {showEmojiPicker && (
          <div
            className="emoji-picker-container-global"
            ref={emojiPickerRef}
            style={{
              top: `${pickerPosition.top}px`,
              left: `${pickerPosition.right}px`,
            }}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              width="100%"
              height={380}
            />
          </div>
        )}

        <div className="dashboard-elements">
          <h3>Relatórios</h3>

          <div className="analytics-tabs">
            {user.role === "admin" && (
              <button
                className={`analytics-tab ${
                  activeReportTab === "eneagrama" ? "active" : ""
                }`}
                onClick={() => setActiveReportTab("eneagrama")}
              >
                Eneagrama
              </button>
            )}

            <button
              className={`analytics-tab ${
                activeReportTab === "cursos" ? "active" : ""
              }`}
              onClick={() => setActiveReportTab("cursos")}
            >
              Cursos
            </button>
          </div>

          <div className="dashboard-elements-child">
            {activeReportTab === "eneagrama" && <EnneagramStats />}
            {activeReportTab === "cursos" && <CoursesAnalytics />}
          </div>
        </div>
      </div>

      <NoticeModal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        onSuccess={() => {
          fetchNotices();
        }}
        noticeToEdit={noticeToEdit}
      />
      <Footer />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDeleteNotice}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Dashboard;
