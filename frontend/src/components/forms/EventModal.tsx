import React, { useState, useEffect, useMemo } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Select, { StylesConfig } from "react-select";
import DatePicker from "./DatePicker.tsx";
import { TimePicker } from "./TimePicker.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";
import Modal from "../ui/Modal.tsx";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import { onKeyActivate } from "../../utils/a11y.ts";

type UserOption = {
  value: number;
  label: string;
};

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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);

  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const customSelectStyles: StylesConfig<UserOption, true> = useMemo(() => {
    const getCssVar = (varName: string) =>
      getComputedStyle(document.body).getPropertyValue(varName).trim();

    return {
      control: (provided) => ({
        ...provided,
        backgroundColor: getCssVar("--bg-primary"),
        borderColor: getCssVar("--border-strong"),
        boxShadow: "none",
        "&:hover": { borderColor: getCssVar("--border-strong") },
      }),
      menu: (provided) => ({
        ...provided,
        backgroundColor: getCssVar("--bg-secondary"),
        zIndex: 9999,
      }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isFocused
          ? getCssVar("--border-color") // Cor ao passar o mouse
          : getCssVar("--bg-secondary"), // Cor de fundo padrão
        color: getCssVar("--text-primary"),
        cursor: "pointer",
        "&:active": { backgroundColor: getCssVar("--border-strong") },
      }),
      input: (provided) => ({
        ...provided,
        color: getCssVar("--text-primary"),
      }),
      singleValue: (provided) => ({
        ...provided,
        color: getCssVar("--text-primary"),
      }),
      multiValue: (provided) => ({
        ...provided,
        backgroundColor: getCssVar("--bg-secondary"),
        border: `1px solid ${getCssVar("--border-strong")}`,
      }),
      multiValueLabel: (provided) => ({
        ...provided,
        color: getCssVar("--text-primary"),
      }),
      multiValueRemove: (provided) => ({
        ...provided,
        color: getCssVar("--text-secondary"),
        ":hover": {
          backgroundColor: getCssVar("--border-strong"),
          color: "red",
        },
      }),
      placeholder: (provided) => ({
        ...provided,
        color: getCssVar("--text-secondary"),
      }),
    };
  }, [theme]); // Recalcula quando o tema muda

  useEffect(() => {
    api.get("/api/admin/events/users-for-notification").then((res) => {
      const userOptions = res.data.map((user: any) => ({
        value: user.id,
        label: user.nome,
      }));
      setAllUsers(userOptions);
    });
  }, []);

  useEffect(() => {
    const getFormattedTime = (date: Date) =>
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    // Data no fuso LOCAL — evita o deslocamento de dia que ocorre ao usar
    // toISOString() (que converte para UTC antes de fatiar a data).
    const getFormattedDate = (date: Date) =>
      String(date.getFullYear()) +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0");

    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setDescription(eventToEdit.description || "");
      setCategory(eventToEdit.category || "");
      setColor(eventToEdit.color || colorPalette[0]);

      const start = new Date(eventToEdit.start_date);
      const end = new Date(eventToEdit.end_date);

      setEventDate(getFormattedDate(start));
      setStartTime(getFormattedTime(start));
      setEndTime(getFormattedTime(end));

      if (allUsers.length > 0) {
        api
          .get(`/api/admin/events/${eventToEdit.id}/notified-users`)
          .then((res) => {
            const notifiedIds = res.data;
            const preSelected = allUsers.filter((user) =>
              notifiedIds.includes(user.value),
            );
            setSelectedUsers(preSelected);
          });
      }
    } else if (selectedDate) {
      let startDateObj = new Date(selectedDate);
      if (!selectedDate.includes("T")) {
        startDateObj = new Date(`${selectedDate}T09:00:00`);
      }
      const endDateObj = new Date(startDateObj.getTime());
      endDateObj.setMinutes(endDateObj.getMinutes() + 30);

      setTitle("");
      setDescription("");
      setEventDate(getFormattedDate(startDateObj));
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
    <>
    <Modal onClose={onClose} title={eventToEdit ? "Editar Evento" : "Criar Novo Evento"}>
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
            <div className="form-group event-modal-group-full">
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
            <div className="color-palette" role="radiogroup" aria-label="Cor do evento">
              {colorPalette.map((c) => (
                <div
                  key={c}
                  className={`color-swatch event-swatch-fill ${
                    color === c ? "selected" : ""
                  }`}
                  style={{ "--event-swatch-color": c } as React.CSSProperties}
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Cor ${c}`}
                  tabIndex={0}
                  onClick={() => setColor(c)}
                  onKeyDown={onKeyActivate(() => setColor(c))}
                />
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Notificar Usuários (opcional)</label>
          </div>
          <div className="form-row">
            <Select
              styles={customSelectStyles}
              isMulti
              options={allUsers}
              value={selectedUsers}
              onChange={(selectedOptions) =>
                setSelectedUsers(selectedOptions as UserOption[])
              }
              placeholder="Selecione os usuários..."
              noOptionsMessage={() => "Nenhum usuário encontrado"}
              classNamePrefix="react-select"
            />
          </div>

          <div>
            <div className="modal-actions">
              {eventToEdit && (
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
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
    </Modal>
    <ConfirmationModal
      isOpen={isDeleteConfirmOpen}
      onClose={() => setIsDeleteConfirmOpen(false)}
      onConfirm={() => {
        setIsDeleteConfirmOpen(false);
        handleDelete();
      }}
      title="Excluir Evento"
      message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."
    />
    </>
  );
};

export default EventModal;
