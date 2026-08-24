import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import { Feedback } from "../../types/feedback.ts";
import { FiTrash2, FiEdit, FiEye } from "react-icons/fi";
import FeedbackInitiateModal from "../../components/forms/FeedbackInitiateModal.tsx";
import FeedbackFillModal from "../../components/forms/FeedbackFillModal.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";

const Feedbacks: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [activeTab, setActiveTab] = useState<"pendentes" | "historico">(
    "pendentes",
  );

  // Estados para os Modais (Implementaremos a seguir)
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [fillModalData, setFillModalData] = useState<Feedback | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    try {
      const res = await api.get("/api/feedbacks");
      setFeedbacks(res.data);
    } catch (err) {
      toast.error("Erro ao carregar feedbacks.");
    }
  }, []);

  useEffect(() => {
    if (user) fetchFeedbacks();
  }, [user, fetchFeedbacks]);

  // Filtragem simples no frontend
  const filteredFeedbacks = feedbacks.filter((f) => {
    if (activeTab === "pendentes") {
      return f.status !== "Concluído" && f.status !== "Recusado";
    }
    return f.status === "Concluído" || f.status === "Recusado";
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Agendado":
        return "status-pending"; // Amarelo
      case "Pendente":
        return "status-pending";
      case "Concluído":
        return "status-validated"; // Verde
      case "Realizado":
        return "status-validated";
      default:
        return "status-declined"; // Vermelho/Cinza
    }
  };

  const handleAction = (feedback: Feedback) => {
    setFillModalData(feedback);
  };

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<number | null>(null);

  const handleDeleteClick = (id: number) => {
    setFeedbackToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!feedbackToDelete) return;
    try {
      await api.delete(`/api/feedbacks/${feedbackToDelete}`);
      toast.success("Feedback excluído!");
      fetchFeedbacks();
    } catch (err) {
      toast.error("Erro ao excluir feedback.");
    } finally {
      setIsConfirmDeleteOpen(false);
      setFeedbackToDelete(null);
    }
  };

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Gestão de Feedbacks</h2>

          {hasPermission("feedbacks.manage") && (
            <button
              className="form-button form-button--add"
              onClick={() => setIsInitiateModalOpen(true)}
            >
              + Coletar Feedback
            </button>
          )}
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "pendentes" ? "active" : ""}`}
            onClick={() => setActiveTab("pendentes")}
          >
            Pendentes
          </button>
          <button
            className={`tab-item ${activeTab === "historico" ? "active" : ""}`}
            onClick={() => setActiveTab("historico")}
          >
            Histórico
          </button>
        </div>

        <div className="list-container">
          <div className="list-header feedback-list-grid">
            <span>De</span>
            <span>Para</span>
            <span>Criado em</span>
            <span>Status</span>
            <span>Ação</span>
          </div>

          {filteredFeedbacks.length > 0 ? (
            filteredFeedbacks.map((fb) => (
              <div key={fb.id} className="list-item feedback-list-grid">
                <span>{fb.evaluator_name}</span>

                <span>{fb.target_name}</span>

                <div className="date-column">
                  <span>
                    {new Date(fb.created_at).toLocaleDateString("pt-BR")}
                    {" às "}
                    {new Date(fb.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="status-column">
                  <span
                    className={`status-badge ${getStatusBadgeClass(fb.status)}`}
                  >
                    {fb.status}
                  </span>
                </div>
                <div className="action-column">
                  {fb.status !== "Concluído" ? (
                    <button
                      className="form-icon-save"
                      onClick={() => handleAction(fb)}
                    >
                      <FiEdit />
                    </button>
                  ) : (
                    <button
                      className="form-icon-edit"
                      onClick={() => handleAction(fb)}
                    >
                      <FiEye />
                    </button>
                  )}
                  {hasPermission("feedbacks.manage") &&
                    fb.status !== "Concluído" && (
                      <button
                        className="form-icon-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(fb.id);
                        }}
                        title="Excluir Feedback"
                      >
                        <FiTrash2 />
                      </button>
                    )}
                </div>
              </div>
            ))
          ) : (
            <p className="feedback-list-empty">
              Nenhum feedback encontrado nesta aba.
            </p>
          )}
        </div>
      </div>

      <Footer />

      <FeedbackInitiateModal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        onSuccess={fetchFeedbacks}
      />

      <FeedbackFillModal
        isOpen={!!fillModalData}
        onClose={() => setFillModalData(null)}
        onSuccess={fetchFeedbacks}
        feedback={fillModalData}
        readOnly={fillModalData?.status === "Concluído"}
      />

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Feedback"
        message="Tem a certeza que deseja excluir este agendamento de feedback? Esta ação é irreversível."
      />
    </div>
  );
};

export default Feedbacks;
