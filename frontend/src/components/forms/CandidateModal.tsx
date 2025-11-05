import React, { useState, useEffect } from "react";
import api from "../../api";
import toast from "react-hot-toast";

interface Stage {
  id: number;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pipelineType: "Recrutamento" | "Onboarding";
}

const CandidateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  pipelineType,
}) => {
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica para submeter o formulário será adicionada aqui
    toast.success("Candidato adicionado!");
    onSuccess();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h3>Adicionar Novo Candidato</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          {/* Campos do formulário (nome, email, etc.) serão adicionados aqui */}
          <div className="form-row">
            <input className="form-input" placeholder="Nome do Candidato" />
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
              Salvar Candidato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateModal;
