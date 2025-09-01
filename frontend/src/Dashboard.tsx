import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import EmptyState from "./EmptyState.tsx";
import EmptyAvisosImage from "./assets/images/empty_avisos.svg";
import EmptyDashsImage from "./assets/images/empty_dashs.svg";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Notice {
  id: number;
  message: string;
  created_at: string;
}

const TiptapMenuBar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-menu-bar">
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

  const powerBiReportUrl =
    "https://app.powerbi.com/view?r=eyJrIjoiNjIyZjRkYTUtZWJiNy00MDg2LTkxMzMtNmNkYjhkN2I0NTQ0IiwidCI6IjBkZWFjZjRhLWZlOGItNDZhMy1iYWM1LTMxODY1YmEzY2Q1NCJ9";

  const [notices, setNotices] = useState<Notice[]>([]);
  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [noticeToDelete, setNoticeToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const newNoticeEditor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  const editNoticeEditor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchNotices = useCallback(async () => {
    try {
      const res = await api.get("/api/notices");
      setNotices(res.data);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      toast.error("Não foi possível carregar os avisos.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotices();
    }
  }, [user, fetchNotices]);

  const handlePostNotice = async () => {
    if (!newNoticeEditor) return;
    const message = newNoticeEditor.getHTML();

    if (newNoticeEditor.isEmpty || message === "<p></p>") {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.post("/api/notices/admin", { message });
      newNoticeEditor.commands.clearContent();
      fetchNotices();
      toast.success("Aviso postado com sucesso!");
    } catch (err) {
      toast.error("Erro ao postar o aviso.");
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

  const handleEditNotice = (notice: Notice) => {
    setEditingNoticeId(notice.id);
    editNoticeEditor?.commands.setContent(notice.message);
  };

  const handleUpdateNotice = async (noticeId: number) => {
    if (!editNoticeEditor) return;
    const message = editNoticeEditor.getHTML();

    if (editNoticeEditor.isEmpty || message === "<p></p>") {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.put(`/api/notices/admin/${noticeId}`, { message });
      toast.success("Aviso atualizado com sucesso!");
      setEditingNoticeId(null);
      editNoticeEditor.commands.clearContent();
      fetchNotices();
    } catch (err) {
      toast.error("Erro ao atualizar o aviso.");
    }
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
          <h2>Bem-vindo, {user.nome}!</h2>
          <p>
            Este é o seu novo Painel da Valor Fiscal!
            <br />
            Aqui você encontra os principais documentos e treinamentos para
            atuar conosco.
          </p>
        </div>

        <div className="dashboard-elements">
          <h3>Mural de Avisos</h3>
          <div className="notice-board">
            {user.role === "admin" && (
              <div className="notice-form">
                <div className="tiptap-container">
                  <TiptapMenuBar editor={newNoticeEditor} />
                  <EditorContent editor={newNoticeEditor} />
                </div>
                <button className="form-button" onClick={handlePostNotice}>
                  Postar Aviso
                </button>
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
                        <TiptapMenuBar editor={editNoticeEditor} />
                        <EditorContent editor={editNoticeEditor} />
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
                              onClick={() => handleDeleteNoticeClick(notice.id)}
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
                title="Não Há Avisos no Momento"
              ></EmptyState>
            )}
          </div>
        </div>

        <div className="dashboard-elements">
          <h3>Relatórios</h3>

          {user.role !== "licenciado" ? (
            <div className="powerbi-container">
              <iframe
                title="Relatório Valor Fiscal"
                src={powerBiReportUrl}
                frameBorder="0"
                allowFullScreen={true}
              ></iframe>
            </div>
          ) : (
            <EmptyState
              image={EmptyDashsImage}
              title="Relatórios Indisponíveis"
              message="Estamos desenvolvendo relatórios e gráficos que serão exibidos aqui futuramente"
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
