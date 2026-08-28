// src/components/forms/ProjectModal.tsx
import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";

interface Project {
  id: number;
  name: string;
  team: string;
  description: string;
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectToEdit?: Project | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectToEdit,
}) => {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(projectToEdit?.name || "");
      setTeam(projectToEdit?.team || "");
      setDescription(projectToEdit?.description || "");
    }
  }, [isOpen, projectToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("O nome do projeto é obrigatório.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (projectToEdit) {
        await api.put(`/api/projects/${projectToEdit.id}`, {
          name,
          team,
          description,
        });
        toast.success("Projeto atualizado com sucesso.");
      } else {
        await api.post("/api/projects", { name, team, description });
        toast.success("Projeto criado com sucesso.");
      }
      onSuccess();
    } catch {
      toast.error("Erro ao salvar o projeto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={projectToEdit ? "Editar Projeto" : "Novo Projeto"}
      closeOnOverlayClick
    >
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <label htmlFor="project-name">Nome do Projeto:</label>
          </div>
          <div className="form-row">
            <input
              id="project-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do projeto"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="project-team">Time Responsável:</label>
          </div>
          <div className="form-row">
            <input
              id="project-team"
              className="form-input"
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Ex: TI, Comercial, Fiscal..."
            />
          </div>

          <div className="form-row">
            <label htmlFor="project-description">Descrição:</label>
          </div>
          <div className="form-row">
            <textarea
              id="project-description"
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente o projeto..."
              rows={4}
            />
          </div>

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
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default ProjectModal;
