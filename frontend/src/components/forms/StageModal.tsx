import React, { useState } from "react";
import api from "../../api";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pipelineType: "Recrutamento" | "Onboarding";
}

const StageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  pipelineType,
}) => {
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica para criar a nova etapa será adicionada aqui
    toast.success("Etapa criada!");
    onSuccess();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h3>Adicionar Nova Etapa em "{pipelineType}"</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-row">
            <input className="form-input" placeholder="Nome da Etapa" />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="form-button-cancel"
            >
              Cancelar
            </button>
            <button type="submit" className="form-button">
              Salvar Etapa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StageModal;
