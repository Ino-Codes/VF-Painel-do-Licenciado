// frontend/src/EventModal.tsx

import React, { useState, useEffect } from "react";
import api from "./api.ts";
import toast from "react-hot-toast";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventToEdit: any | null;
  selectedDate: string | null;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  eventToEdit,
  selectedDate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setDescription(eventToEdit.description || "");
      setStartDate(eventToEdit.start_date.substring(0, 10)); // Formato YYYY-MM-DD
      setEndDate(eventToEdit.end_date.substring(0, 10)); // Formato YYYY-MM-DD
      setCategory(eventToEdit.category || "");
    } else if (selectedDate) {
      setTitle("");
      setDescription("");
      setStartDate(selectedDate);
      setEndDate(selectedDate);
      setCategory("");
    }
  }, [eventToEdit, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate || !category.trim()) {
      toast.error("Título, Datas e Categoria são obrigatórios.");
      return;
    }
    const eventData = {
      title,
      description,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      category,
    };

    try {
      if (eventToEdit) {
        await api.put(`/api/admin/events/${eventToEdit.id}`, eventData);
        toast.success("Evento atualizado com sucesso!");
      } else {
        await api.post("/api/admin/events", eventData);
        toast.success("Evento criado com sucesso!");
      }
      onSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o evento.");
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/admin/events/${eventToEdit.id}`);
      toast.success("Evento excluído com sucesso!");
      onSuccess();
    } catch (err) {
      toast.error("Erro ao excluir o evento.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{eventToEdit ? "Editar Evento" : "Criar Novo Evento"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Título do Evento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              list="category-suggestions"
              placeholder="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
              required
            />
            <datalist id="category-suggestions">
              <option value="Aniversário" />
              <option value="Comemoração" />
              <option value="Feriado" />
              <option value="Happy Hour" />
              <option value="Reunião" />
            </datalist>
          </div>
          <div className="form-row">
            <div style={{ flex: 1 }}>
              <label>Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <textarea
              placeholder="Descrição (opcional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              rows={4}
            />
          </div>
          <div
            className="modal-actions"
            style={{ justifyContent: "space-between" }}
          >
            <div>
              {eventToEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="form-button delete"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
              )}
            </div>
            <div>
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
