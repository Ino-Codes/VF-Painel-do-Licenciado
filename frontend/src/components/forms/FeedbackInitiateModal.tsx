import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";
import DatePicker from "./DatePicker.tsx";
import { TimePicker } from "./TimePicker.tsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  id: number;
  nome: string;
  unidade: string;
}

const FeedbackInitiateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [users, setUsers] = useState<UserOption[]>([]);

  // Estados separados para Data e Hora, igual ao EventModal
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [formData, setFormData] = useState({
    evaluator_user_id: "",
    type: "FORNECER", // Padrão
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Busca apenas utilizadores internos
      api
        .get("/api/users/internal")
        .then((res) => setUsers(res.data))
        .catch(() => toast.error("Erro ao carregar lista de colaboradores."));
    }
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Lógica de validação de fim de semana (igual ao EventModal)
  const handleDateChange = (dateString: string) => {
    const selected = new Date(`${dateString}T12:00:00`);
    const dayOfWeek = selected.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast.error("Não é possível agendar feedbacks aos sábados ou domingos.");
      return;
    }
    setSelectedDate(dateString);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.evaluator_user_id) {
      toast.error("Selecione um colaborador.");
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error("Selecione a data e a hora da reunião.");
      return;
    }

    setIsSubmitting(true);

    // Combina data e hora para o formato ISO (igual ao EventModal)
    const scheduledAtIso = new Date(
      `${selectedDate}T${selectedTime}`,
    ).toISOString();

    const payload = {
      ...formData,
      scheduled_at: scheduledAtIso,
    };

    try {
      await api.post("/api/feedbacks", payload);
      toast.success("Processo de feedback iniciado!");
      onSuccess();
      handleClose(); // Usa a função interna para limpar estados
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Limpa o formulário ao fechar
    setFormData({
      evaluator_user_id: "",
      type: "FORNECER",
      message: "",
    });
    setSelectedDate("");
    setSelectedTime("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={handleClose}>
          <IoCloseSharp />
        </button>

        <h2>Novo Feedback</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Avaliador</label>
              <select
                name="evaluator_user_id"
                value={formData.evaluator_user_id}
                onChange={handleChange}
                className="form-select"
                required
              >
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.unidade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data da Reunião</label>
              <DatePicker value={selectedDate} onChange={handleDateChange} />
            </div>
            <div className="form-group feedback-initiate-time-group">
              <label>Hora</label>
              <TimePicker value={selectedTime} onChange={setSelectedTime} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Mensagem (Opcional)</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                className="form-input"
                rows={3}
                placeholder="Mensagem que aparecerá na notificação..."
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="form-button-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="form-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackInitiateModal;
