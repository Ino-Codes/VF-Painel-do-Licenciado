import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";

interface FaqModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const FaqModal: React.FC<FaqModalProps> = ({ onClose, onSuccess }) => {
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !question || !answer) {
      toast.error("Categoria, Pergunta e Resposta são campos obrigatórios.");
      return;
    }

    const formData = new FormData();
    formData.append("category", category);
    formData.append("question", question);
    formData.append("answer", answer);

    try {
      await api.post("/api/faq/admin", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("FAQ adicionado com sucesso!");
      onSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o FAQ.");
      console.error(err);
    }
  };

  return (
    <Modal onClose={onClose} title="Adicionar Novo FAQ">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Pergunta"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <textarea
              placeholder="Resposta detalhada..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
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
              Salvar
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default FaqModal;
