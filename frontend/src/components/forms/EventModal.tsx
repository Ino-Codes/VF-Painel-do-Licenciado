import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Select from "react-select";
import DatePicker from "./DatePicker.tsx";
import { TimePicker } from "./TimePicker.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  eventToEdit: any | null;
  selectedDate: string | null;
  categories: string[];
}

const colorPalette = ["#efcb6e", "#81e18c", "#b8b8b8", "#81a7e1", "#e18181"];

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  eventToEdit,
  selectedDate,
  categories,
}) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState(colorPalette[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    api.get("/api/admin/events/users-for-notification").then((res) => {
      const userOptions = res.data.map((user) => ({
        value: user.id,
        label: user.nome,
      }));
      setAllUsers(userOptions);
    });
  }, [theme]);

  useEffect(() => {
    const getFormattedTime = (date: Date) =>
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setDescription(eventToEdit.description || "");
      setCategory(eventToEdit.category || "");
      setColor(eventToEdit.color || colorPalette[0]);

      const start = new Date(eventToEdit.start_date);
      const end = new Date(eventToEdit.end_date);

      setEventDate(start.toISOString().split("T")[0]);
      setStartTime(getFormattedTime(start));
      setEndTime(getFormattedTime(end));

      api
        .get(`/api/admin/events/${eventToEdit.id}/notified-users`)
        .then((res) => {
          const notifiedIds = res.data;
          const preSelected = allUsers.filter((user) =>
            notifiedIds.includes(user.value)
          );
          setSelectedUsers(preSelected);
        });
    } else if (selectedDate) {
      let startDateObj = new Date(selectedDate);
      if (!selectedDate.includes("T")) {
        startDateObj = new Date(`${selectedDate}T09:00:00`);
      }
      const endDateObj = new Date(startDateObj.getTime());
      endDateObj.setMinutes(endDateObj.getMinutes() + 30);

      setTitle("");
      setDescription("");
      setEventDate(startDateObj.toISOString().split("T")[0]);
      setStartTime(getFormattedTime(startDateObj));
      setEndTime(getFormattedTime(endDateObj));
      setCategory("");
      setColor(colorPalette[0]);
      setSelectedUsers([]);
    }
  }, [eventToEdit, selectedDate, allUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventData = {
      title,
      description,
      start_date: new Date(`${eventDate}T${startTime}`).toISOString(),
      end_date: new Date(`${eventDate}T${endTime}`).toISOString(),
      category,
      color,
      notifiedUserIds: selectedUsers.map((u) => u.value),
    };
    try {
      if (eventToEdit) {
        await api.put(`/api/admin/events/${eventToEdit.id}`, eventData);
        toast.success("Evento atualizado!");
      } else {
        await api.post("/api/admin/events", eventData);
        toast.success("Evento criado!");
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

  const handleDateChange = (dateString: string) => {
    const selected = new Date(`${dateString}T12:00:00`);
    const dayOfWeek = selected.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast.error("Não é possível agendar eventos aos sábados ou domingos.");
      return;
    }
    setEventDate(dateString);
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
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ width: "100%" }}>
              <label>Data do Evento</label>
              <DatePicker value={eventDate} onChange={handleDateChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Início</label>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="form-group">
              <label>Fim</label>
              <TimePicker value={endTime} onChange={setEndTime} />
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

          <div className="form-row">
            <label>Cor do Evento</label>
          </div>
          <div className="form-row">
            <div className="color-palette">
              {colorPalette.map((c) => (
                <div
                  key={c}
                  className={`color-swatch ${color === c ? "selected" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Notificar Usuários (opcional)</label>
          </div>
          <div className="form-row">
            <Select
              className="form-select"
              isMulti
              options={allUsers}
              value={selectedUsers}
              onChange={(selectedOptions) => setSelectedUsers(selectedOptions)}
              placeholder="Selecione os usuários..."
              noOptionsMessage={() => "Nenhum usuário encontrado"}
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
