import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from ".../api.ts";
import { useAuth } from ".../context/AuthContext.tsx";
import Menu from ".../components/layout/Menu.tsx";
import Footer from ".../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from ".../components/ui/ConfirmationModal.tsx";
import EmptyState from ".../components/ui/EmptyState.tsx";
import EventCard from "./EventCard.tsx";
import EnneagramStats from "./EnneagramStats.tsx";

import EmptyEventsImage from ".../assets/images/empty_eventos.svg";
import EmptyAvisosImage from ".../assets/images/empty_avisos.svg";
import EmptyDashsImage from ".../assets/images/empty_dashs.svg";

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

const TiptapMenuBar: React.FC<{
  editor: Editor | null;
  onEmojiToggle: (event: React.MouseEvent) => void;
}> = ({ editor, onEmojiToggle }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-menu-bar">
      <div className="emoji-picker-wrapper-in-menu">
        <button
          className="emoji-toggle-button"
          type="button"
          onClick={onEmojiToggle}
        >
          🙂
        </button>
      </div>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive("bold") ? "is-active" : ""}
      >
        Negrito
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive("italic") ? "is-active" : ""}
      >
        Itálico
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive("orderedList") ? "is-active" : ""}
      >
        Lista Numerada
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive("bulletList") ? "is-active" : ""}
      >
        Lista Pontuada
      </button>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [monthlyEvents, setMonthlyEvents] = useState<MonthlyEvent[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeToDelete, setNoticeToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    right: number;
  }>({ top: 0, right: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [noticeVisibility, setNoticeVisibility] = useState<
    "todos" | "internos" | "licenciados"
  >("todos");

  const newNoticeEditor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });
  const editNoticeEditor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

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

  const handlePostNotice = async () => {
    if (!newNoticeEditor) return;
    const message = newNoticeEditor.getHTML();

    if (newNoticeEditor.isEmpty || message === "<p></p>") {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.post("/api/notices/admin", {
        message,
        visibility: noticeVisibility,
      });
      newNoticeEditor.commands.clearContent();
      setNoticeVisibility("todos");
      fetchNotices();
      toast.success("Aviso postado com sucesso!");
    } catch (err) {
      toast.error("Erro ao postar o aviso.");
    }
  };

  const handleEditNotice = (notice: Notice) => {
    setEditingNoticeId(notice.id);
    editNoticeEditor?.commands.setContent(notice.message);
    setNoticeVisibility(notice.visibility || "todos");
  };

  const handleUpdateNotice = async (noticeId: number) => {
    if (!editNoticeEditor) return;
    const message = editNoticeEditor.getHTML();

    if (editNoticeEditor.isEmpty || message === "<p></p>") {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.put(`/api/notices/admin/${noticeId}`, {
        message,
        visibility: noticeVisibility,
      });
      toast.success("Aviso atualizado com sucesso!");
      setEditingNoticeId(null);
      editNoticeEditor.commands.clearContent();
      fetchNotices();
    } catch (err) {
      toast.error("Erro ao atualizar o aviso.");
    }
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
                    image={EmptyEventsImage}
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
                <div className="notice-form">
                  <div className="tiptap-container">
                    <TiptapMenuBar
                      editor={newNoticeEditor}
                      onEmojiToggle={(e) =>
                        toggleEmojiPicker(newNoticeEditor, e)
                      }
                    />
                    <EditorContent editor={newNoticeEditor} />
                  </div>
                  <div className="visibility-selector">
                    <label>Enviar para:</label>
                    <div className="radio-group">
                      <label>
                        <input
                          type="radio"
                          name="visibilityCreate"
                          value="todos"
                          checked={noticeVisibility === "todos"}
                          onChange={() => setNoticeVisibility("todos")}
                        />{" "}
                        Todos
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="visibilityCreate"
                          value="internos"
                          checked={noticeVisibility === "internos"}
                          onChange={() => setNoticeVisibility("internos")}
                        />{" "}
                        Apenas Internos
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="visibilityCreate"
                          value="licenciados"
                          checked={noticeVisibility === "licenciados"}
                          onChange={() => setNoticeVisibility("licenciados")}
                        />{" "}
                        Apenas Licenciados
                      </label>
                    </div>
                  </div>
                  <div className="notice-form-actions">
                    <button className="form-button" onClick={handlePostNotice}>
                      Postar Aviso
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="notice-list">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <div key={notice.id} className="notice-card">
                    {editingNoticeId === notice.id ? (
                      <div className="notice-edit-form">
                        <div className="tiptap-container">
                          <TiptapMenuBar
                            editor={editNoticeEditor}
                            onEmojiToggle={(e) =>
                              toggleEmojiPicker(editNoticeEditor, e)
                            }
                          />
                          <EditorContent editor={editNoticeEditor} />
                        </div>
                        <div className="visibility-selector">
                          <label>Enviar para:</label>
                          <div className="radio-group">
                            <label>
                              <input
                                type="radio"
                                name={`visibility-edit-${notice.id}`}
                                value="todos"
                                checked={noticeVisibility === "todos"}
                                onChange={() => setNoticeVisibility("todos")}
                              />{" "}
                              Todos
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`visibility-edit-${notice.id}`}
                                value="internos"
                                checked={noticeVisibility === "internos"}
                                onChange={() => setNoticeVisibility("internos")}
                              />{" "}
                              Apenas Internos
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`visibility-edit-${notice.id}`}
                                value="licenciados"
                                checked={noticeVisibility === "licenciados"}
                                onChange={() =>
                                  setNoticeVisibility("licenciados")
                                }
                              />{" "}
                              Apenas Licenciados
                            </label>
                          </div>
                        </div>
                        <div className="notice-actions">
                          <button
                            className="list-button"
                            onClick={() => setEditingNoticeId(null)}
                          >
                            Cancelar
                          </button>
                          <button
                            className="list-button"
                            onClick={() => handleUpdateNotice(notice.id)}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
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
                                onClick={() => handleEditNotice(notice)}
                              >
                                Editar
                              </button>
                              <button
                                className="delete-button"
                                onClick={() =>
                                  handleDeleteNoticeClick(notice.id)
                                }
                              >
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  image={EmptyAvisosImage}
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
          {user.role === "admin" ? (
            <div
              className="dashboard-elements"
              style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}
            >
              <h4>Análise Comportamental (Eneagrama)</h4>
              <EnneagramStats />
            </div>
          ) : (
            <EmptyState
              image={EmptyDashsImage}
              title="Relatórios em Desenvolvimento"
              message="Estamos criando relatórios e gráficos que serão exibidos aqui futuramente."
            />
          )}
        </div>
      </div>

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
