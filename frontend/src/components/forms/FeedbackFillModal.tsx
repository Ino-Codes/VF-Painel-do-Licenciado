import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";
import {
  Feedback,
  FeedbackTheme,
  FeedbackEntry,
} from "../../types/feedback.ts";
import { FiTrash2, FiPlus } from "react-icons/fi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  feedback: Feedback | null;
  readOnly?: boolean;
}

interface UserOption {
  id: number;
  nome: string;
  role: string;
}

const FeedbackFillModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  feedback,
  readOnly = false,
}) => {
  const [themes, setThemes] = useState<FeedbackTheme[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]); // Lista para o select de alvo
  const [targetUserId, setTargetUserId] = useState<number | string>(""); // Estado do alvo
  const [generalComments, setGeneralComments] = useState("");
  const [entries, setEntries] = useState<Partial<FeedbackEntry>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carrega dados iniciais
  useEffect(() => {
    if (isOpen && feedback) {
      // 1. Carregar Temas
      api
        .get("/api/feedbacks/themes")
        .then((res) => setThemes(res.data))
        .catch(() => console.error("Erro ao carregar temas"));

      // 2. Carregar Usuários (apenas se não for readOnly, para poder escolher)
      if (!readOnly) {
        api
          .get("/api/users/internal")
          .then((res) => setUsers(res.data))
          .catch(() => console.error("Erro ao carregar usuários"));
      }

      // 3. Carregar detalhes do feedback
      api
        .get(`/api/feedbacks/${feedback.id}`)
        .then((res) => {
          const data = res.data;
          setGeneralComments(data.general_comments || "");
          setEntries(
            data.entries && data.entries.length > 0 ? data.entries : [],
          );

          // Se já tiver um alvo definido (ex: edição ou visualização), carrega-o
          if (data.target_user_id) {
            setTargetUserId(data.target_user_id);
          } else {
            setTargetUserId(feedback.evaluator_user_id); // Opcional: pré-selecionar
          }
        })
        .catch((err) => toast.error("Erro ao carregar detalhes."));
    }
  }, [isOpen, feedback, readOnly]);

  const handleAddEntry = () => {
    setEntries([
      ...entries,
      { theme_id: 0, positive_points: "", improvement_points: "" },
    ]);
  };

  const handleRemoveEntry = (index: number) => {
    const newEntries = [...entries];
    newEntries.splice(index, 1);
    setEntries(newEntries);
  };

  const handleEntryChange = (
    index: number,
    field: keyof FeedbackEntry,
    value: any,
  ) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback) return;

    if (!targetUserId) {
      toast.error("Por favor, selecione sobre quem é este feedback.");
      return;
    }

    if (entries.length === 0) {
      toast.error("Adicione pelo menos um tema ao feedback.");
      return;
    }
    for (const entry of entries) {
      if (!entry.theme_id) {
        toast.error("Selecione um tema para todos os itens.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await api.put(`/api/feedbacks/${feedback.id}/submit`, {
        target_user_id: Number(targetUserId), // Envia o alvo selecionado
        general_comments: generalComments,
        entries: entries,
      });
      toast.success("Feedback salvo com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Erro ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !feedback) return null;

  return (
    <Modal
      onClose={onClose}
      title={readOnly ? "Visualizar Feedback" : "Realizar Coleta de Feedback"}
      className="feedback-fill-modal"
      closeOnOverlayClick
    >
        {/* Cabeçalho de Informações Fixas */}
        <div className="feedback-header-info">
          <p>
            <strong>Avaliador:</strong> {feedback.evaluator_name}{" "}
            {/* Ajuste se o nome vier de outro campo na listagem */}
          </p>
          <p>
            <strong>Data Agendada:</strong>{" "}
            {feedback.scheduled_at
              ? new Date(feedback.scheduled_at).toLocaleDateString()
              : "N/A"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* --- NOVO CAMPO: SELEÇÃO DO ALVO DO FEEDBACK --- */}

          <div className="form-row">
            <div className="form-group">
              <label>Sobre quem é este feedback?</label>
              {readOnly ? (
                <div>{feedback.target_name || "Usuário não identificado"}</div>
              ) : (
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">Selecione o colaborador avaliado...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.role})
                    </option>
                  ))}
                </select>
              )}
              {!readOnly && (
                <small className="feedback-fill-hint">
                  Selecione o próprio avaliador para uma autoavaliação, ou outro
                  colaborador para feedback de pares e lideranças.
                </small>
              )}
            </div>
          </div>

          <div className="feedback-entries-list">
            {entries.map((entry, index) => (
              <div key={index} className="feedback-entry-card">
                <div className="feedback-entry-header">
                  <div className="feedback-fill-theme-select-wrap">
                    <select
                      value={entry.theme_id || ""}
                      onChange={(e) =>
                        handleEntryChange(
                          index,
                          "theme_id",
                          Number(e.target.value),
                        )
                      }
                      className="form-select feedback-fill-theme-select"
                      disabled={readOnly}
                    >
                      <option value="">Selecione um tema...</option>
                      {themes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(index)}
                      className="delete-button"
                      title="Remover este tema"
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>

                <div className="feedback-text-area-group">
                  <div className="feedback-text-column">
                    <label className="feedback-label-positive">
                      Pontos Positivos
                    </label>
                    <textarea
                      className="feedback-textarea"
                      value={entry.positive_points || ""}
                      onChange={(e) =>
                        handleEntryChange(
                          index,
                          "positive_points",
                          e.target.value,
                        )
                      }
                      disabled={readOnly}
                      placeholder="Destaque o que foi bem feito..."
                    />
                  </div>

                  <div className="feedback-text-column">
                    <label className="feedback-label-improvement">
                      Pontos de Melhoria
                    </label>
                    <textarea
                      className="feedback-textarea"
                      value={entry.improvement_points || ""}
                      onChange={(e) =>
                        handleEntryChange(
                          index,
                          "improvement_points",
                          e.target.value,
                        )
                      }
                      disabled={readOnly}
                      placeholder="O que precisa ser desenvolvido..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {!readOnly && (
              <button
                type="button"
                onClick={handleAddEntry}
                className="btn-add-theme"
              >
                <FiPlus /> Adicionar Novo Tema de Avaliação
              </button>
            )}

            <div className="general-comments-section">
              <label>Comentários Gerais</label>
              <textarea
                className="feedback-textarea"
                rows={4}
                value={generalComments}
                onChange={(e) => setGeneralComments(e.target.value)}
                disabled={readOnly}
                placeholder="Resumo final, próximos passos ou acordos..."
              />
            </div>
          </div>

          {!readOnly && (
            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="form-button-cancel"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="form-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Salvando..." : "Finalizar Feedback"}
              </button>
            </div>
          )}
        </form>
    </Modal>
  );
};

export default FeedbackFillModal;
