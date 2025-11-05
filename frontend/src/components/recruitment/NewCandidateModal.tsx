import React, { useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { Candidate } from "../../types/recruitment.ts";

interface NewCandidateModalProps {
  onClose: () => void;
  onSave: () => void;
}

const NewCandidateModal: React.FC<NewCandidateModalProps> = ({
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role_applied_for: "",
    status: "EM_PROCESSO",
  });

  const api = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Pega a primeira etapa para o candidato
      const stagesResponse = await api.get("/api/recruitment/stages");
      const stages = stagesResponse.data;
      const firstStage = stages.length > 0 ? stages[0] : null;

      if (!firstStage) {
        toast.error("É necessário criar uma etapa primeiro");
        return;
      }

      await api.post("/api/recruitment/candidates", {
        ...formData,
        stage_id: firstStage.id,
        user_id: null, // será definido no backend
      });

      toast.success("Candidato adicionado com sucesso!");
      onSave();
      onClose();
    } catch (error) {
      console.error("Erro ao adicionar candidato:", error);
      toast.error("Erro ao adicionar candidato");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>

        <h2 className="modal-title">Novo Candidato</h2>

        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="name">Nome</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefone</label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Cargo</label>
            <input
              type="text"
              id="role"
              value={formData.role_applied_for}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  role_applied_for: e.target.value,
                }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="form-button">
              Adicionar Candidato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCandidateModal;
