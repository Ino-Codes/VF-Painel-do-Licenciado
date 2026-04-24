// src/components/forms/TaskModal.tsx
import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";

interface ProjectTask {
  id: number;
  project_id: number;
  name: string;
  start_year: number;
  start_month: number;
  end_year: number;
  end_month: number;
  color: string;
  order_index: number;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  taskToEdit?: ProjectTask | null;
}

const MONTHS_PT = [
  { label: "Janeiro", value: 1 },
  { label: "Fevereiro", value: 2 },
  { label: "Março", value: 3 },
  { label: "Abril", value: 4 },
  { label: "Maio", value: 5 },
  { label: "Junho", value: 6 },
  { label: "Julho", value: 7 },
  { label: "Agosto", value: 8 },
  { label: "Setembro", value: 9 },
  { label: "Outubro", value: 10 },
  { label: "Novembro", value: 11 },
  { label: "Dezembro", value: 12 },
];

const COLOR_PALETTE = [
  { label: "Amarelo", value: "#ffe44d" },
  { label: "Laranja", value: "#e8a020" },
  { label: "Vermelho", value: "#c0392b" },
  { label: "Roxo", value: "#7d3c98" },
  { label: "Azul", value: "#1a6fa8" },
  { label: "Azul Claro", value: "#38a5e4" },
  { label: "Ciano", value: "#43e6a7" },
  { label: "Verde", value: "#4a8c2a" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  taskToEdit,
}) => {
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endYear, setEndYear] = useState<number>(currentYear);
  const [endMonth, setEndMonth] = useState<number>(1);
  const [color, setColor] = useState(COLOR_PALETTE[0].value);
  const [orderIndex, setOrderIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(taskToEdit?.name || "");
      setStartYear(taskToEdit?.start_year ?? currentYear);
      setStartMonth(taskToEdit?.start_month ?? 1);
      setEndYear(taskToEdit?.end_year ?? currentYear);
      setEndMonth(taskToEdit?.end_month ?? 1);
      setColor(taskToEdit?.color || COLOR_PALETTE[0].value);
      setOrderIndex(taskToEdit?.order_index ?? 0);
    }
  }, [isOpen, taskToEdit]);

  if (!isOpen) return null;

  // Valida se o período de fim é igual ou posterior ao de início
  const isPeriodValid = () => {
    if (endYear > startYear) return true;
    if (endYear === startYear && endMonth >= startMonth) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("O nome da tarefa é obrigatório.");
      return;
    }

    if (!isPeriodValid()) {
      toast.error("O mês/ano de fim não pode ser anterior ao de início.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        start_year: startYear,
        start_month: startMonth,
        end_year: endYear,
        end_month: endMonth,
        color,
        order_index: orderIndex,
      };

      if (taskToEdit) {
        await api.put(
          `/api/projects/${projectId}/tasks/${taskToEdit.id}`,
          payload,
        );
        toast.success("Tarefa atualizada com sucesso.");
      } else {
        await api.post(`/api/projects/${projectId}/tasks`, payload);
        toast.success("Tarefa criada com sucesso.");
      }

      onSuccess();
    } catch {
      toast.error("Erro ao salvar a tarefa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          <IoCloseSharp />
        </button>

        <h2>{taskToEdit ? "Editar Tarefa" : "Nova Tarefa"}</h2>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Nome */}
          <div className="form-row">
            <label htmlFor="visibility" style={{ marginRight: "10px" }}>
              Nome da Tarefa:
            </label>
          </div>
          <div className="form-row">
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Levantamento de requisitos"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Início</label>
              <div className="task-period-row">
                <select
                  className="form-input"
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                >
                  {MONTHS_PT.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="form-input"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Fim</label>
              <div className="task-period-row">
                <select
                  className="form-input"
                  value={endMonth}
                  onChange={(e) => setEndMonth(Number(e.target.value))}
                >
                  {MONTHS_PT.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  className="form-input"
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cor da barra */}
          <div className="form-row">
            <label>Cor da Tarefa</label>
          </div>
          <div className="form-row">
            <div className="task-color-palette">
              {COLOR_PALETTE.map((c) => (
                <div
                  key={c.value}
                  className={`color-swatch ${color === c.value ? "selected" : ""}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>

          {/* Ordem */}
          <div className="form-row">
            <label>Ordem</label>
          </div>
          <div className="form-row">
            <input
              className="form-input"
              type="number"
              value={orderIndex}
              min={0}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
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
            <button
              type="submit"
              className="form-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
