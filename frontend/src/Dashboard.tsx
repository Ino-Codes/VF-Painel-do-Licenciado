import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
// ... outras importações
import EmptyState from "./EmptyState.tsx";
import EmptyAvisosImage from "./assets/images/empty_avisos.svg";
import EmptyDashsImage from "./assets/images/empty_dashs.svg";

interface Notice {
  id: number;
  message: string;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [noticeToDelete, setNoticeToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchNotices = async () => {
    try {
      const res = await api.get("/api/notices");
      setNotices(res.data);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      toast.error("Não foi possível carregar os avisos.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotices();
    }
  }, [user]);

  const handlePostNotice = async () => {
    if (!newMessage.trim()) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.post("/api/notices/admin", { message: newMessage });
      setNewMessage("");
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
    setEditText(notice.message);
  };

  const handleUpdateNotice = async (noticeId: number) => {
    if (!editText.trim()) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    try {
      await api.put(`/api/notices/admin/${noticeId}`, { message: editText });
      toast.success("Aviso atualizado com sucesso!");
      setEditingNoticeId(null);
      setEditText("");
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

        <div className="dashboard-grid">
          <div className="notice-board">
            <h3>Mural de Avisos</h3>

            {user.role === "admin" && (
              <div className="notice-form">
                <textarea
                  placeholder="Digite seu novo aviso aqui..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button className="form-button" onClick={handlePostNotice}>
                  Postar Aviso
                </button>
              </div>
            )}

            <div className="notice-list">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <div key={notice.id} className="notice-card">
                    {editingNoticeId === notice.id ? (
                      <div className="notice-edit-form">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <div className="notice-actions">
                          <button
                            className="list-button"
                            onClick={() => setEditingNoticeId(null)}
                          >
                            Cancelar
                          </button>
                          <button
                            className="list-button edit"
                            onClick={() => handleUpdateNotice(notice.id)}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{notice.message}</p>
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
                                className="list-button edit"
                                onClick={() => handleEditNotice(notice)}
                              >
                                Editar
                              </button>
                              <button
                                className="list-button delete"
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
                  title="Não há avisos no momento."
                ></EmptyState>
              )}
            </div>
          </div>

          <div className="placeholder-column">
            <h3>Relatórios</h3>
            <div className="placeholder-content">
              <span>Gráficos e relatórios serão exibidos aqui em breve.</span>
            </div>
          </div>
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
