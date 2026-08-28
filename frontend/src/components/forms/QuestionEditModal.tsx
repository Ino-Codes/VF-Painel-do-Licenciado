import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";
import { Question } from "../../types.ts";

interface QuestionEditModalProps {
  question: Partial<Question>;
  onClose: () => void;
  onSave: (questionText: string) => Promise<void>;
}

const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  question,
  onClose,
  onSave,
}) => {
  const [questionText, setQuestionText] = useState("");

  useEffect(() => {
    // Sempre sincroniza (inclusive resetando para "" ao abrir para uma nova pergunta).
    setQuestionText(question?.question_text || "");
  }, [question]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast.error("O texto da pergunta não pode estar vazio.");
      return;
    }
    await onSave(questionText);
  };

  return (
    <Modal onClose={onClose} title={question.id ? "Editar Pergunta" : "Adicionar Nova Pergunta"}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <textarea
              placeholder="Digite o texto da pergunta aqui..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="form-input"
              rows={5}
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
              Salvar Pergunta
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default QuestionEditModal;
