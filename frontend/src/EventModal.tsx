import React, { useState } from "react";
import api from "./api.ts";
import toast from "react-hot-toast";

interface EventModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [eventDate, setEventDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventDate) {
      toast.error("O nome e a data do evento são obrigatórios.");
      return;
    }

    try {
      await api.post("/api/events", {
        title,
        details,
        event_date: eventDate,
      });
      toast.success("Evento adicionado com sucesso!");
      onSuccess();
    } catch (err) {
      toast.error("Erro ao adicionar o evento.");
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Adicionar Novo Evento</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Nome do Evento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <input
              type="datetime-local" // Campo para data e hora
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <textarea
              placeholder="Detalhes do Evento (Opcional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="form-input"
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
            <button type="submit" className="form-button">
              Salvar Evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
