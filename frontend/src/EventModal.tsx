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

// Função auxiliar para formatar um objeto Date para o input datetime-local
const formatDateTimeForInput = (date: Date): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
      // Para editar, a data já vem completa (ISO string), então new Date() funciona corretamente.
      setStartDate(formatDateTimeForInput(new Date(eventToEdit.start_date)));
      setEndDate(formatDateTimeForInput(new Date(eventToEdit.end_date)));
      setCategory(eventToEdit.category || "");
    } else if (selectedDate) {
      // --- ESTA É A CORREÇÃO PARA O BUG ---
      // Quando clicamos num dia no modo "mês", selectedDate vem como "YYYY-MM-DD".
      // new Date("YYYY-MM-DD") interpreta como UTC.
      // Ao adicionar "T09:00:00", forçamos o JavaScript a interpretar a string no fuso horário LOCAL.
      // Isso garante que "2025-09-03" seja entendido como 9 da manhã do dia 3, e não 9 da noite do dia 2.
      const localDate = new Date(`${selectedDate}T09:00:00`);

      setTitle("");
      setDescription("");
      setStartDate(formatDateTimeForInput(localDate));
      setEndDate(formatDateTimeForInput(localDate)); // Define a mesma data/hora de início como padrão
      setCategory("");
    }
  }, [eventToEdit, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate || !category.trim()) {
      toast.error("Título, Datas, Horários e Categoria são obrigatórios.");
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
              <option value="Feriado" />
              <option value="Happy Hour" />
            </datalist>
          </div>
          <div className="form-row">
            <div style={{ flex: 1 }}>
              <label>Início</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Fim</label>
              <input
                type="datetime-local"
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
          <div>
            <div className="modal-actions">
              {eventToEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="form-button delete"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Excluindo" : "Excluir"}
                </button>
              )}
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
