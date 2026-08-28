import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";
import { Option } from "../../types.ts";

interface OptionEditModalProps {
  option: Partial<Option>;
  onClose: () => void;
  onSave: (optionText: string) => Promise<void>;
}

const OptionEditModal: React.FC<OptionEditModalProps> = ({
  option,
  onClose,
  onSave,
}) => {
  const [optionText, setOptionText] = useState("");

  useEffect(() => {
    // Sempre sincroniza (inclusive resetando para "" ao abrir para uma nova opção).
    setOptionText(option?.option_text || "");
  }, [option]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optionText.trim()) {
      toast.error("O texto da opção não pode estar vazio.");
      return;
    }
    await onSave(optionText);
  };

  return (
    <Modal onClose={onClose} title={option.id ? "Editar Opção" : "Adicionar Nova Opção"}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Digite o texto da opção de resposta"
              value={optionText}
              onChange={(e) => setOptionText(e.target.value)}
              className="form-input"
              required
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
            <button type="submit" className="form-button">
              Salvar Opção
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default OptionEditModal;
