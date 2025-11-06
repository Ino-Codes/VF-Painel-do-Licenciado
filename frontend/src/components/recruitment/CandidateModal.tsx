import React, { useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import { format } from "date-fns";

interface Task {
  id: number;
  task_name: string;
  is_completed: boolean;
  responsible_user_id: number;
  due_date: string;
}

interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  role_applied_for: string;
  status: string;
  stage_id: number;
  user_id: number;
  unit_id?: number;
  unit_name?: string;
  stage_name?: string;
  responsible_name?: string;
  tasks?: Task[];
}

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: () => void;
}

const CandidateModal: React.FC<CandidateModalProps> = ({
  candidate,
  onClose,
  onUpdate,
}) => {
  const [tasks, setTasks] = useState(candidate.tasks || []);
  const [newTask, setNewTask] = useState({
    task_name: "",
    responsible_user_id: candidate.user_id || "",
    due_date: format(new Date(), "yyyy-MM-dd"),
  });

  const api = useApi();

  const handleTaskToggle = async (taskId: number, currentStatus: boolean) => {
    try {
      await api.put(`/api/recruitment/tasks/${taskId}`, {
        is_completed: !currentStatus,
      });

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, is_completed: !currentStatus } : task
        )
      );

      onUpdate();
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await api.post(
        `/api/recruitment/candidates/${candidate.id}/tasks`,
        newTask
      );

      setTasks((prevTasks) => [...prevTasks, response.data]);
      setNewTask({
        task_name: "",
        responsible_user_id: candidate.user_id || "",
        due_date: format(new Date(), "yyyy-MM-dd"),
      });

      onUpdate();
    } catch (error) {
      console.error("Erro ao adicionar tarefa:", error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content candidate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>

        <div className="candidate-info-section">
          <div className="candidate-info-header">
            <div className="candidate-info-main">
              <span
                className={`candidate-status ${candidate.status.toLowerCase()}`}
              >
                {candidate.status}
              </span>
              <h2>{candidate.name}</h2>
              <div className="candidate-info-details">
                <p>
                  {candidate.role_applied_for} · {candidate.stage_name}
                </p>
                {candidate.unit_name && (
                  <p className="candidate-unit">
                    Unidade: {candidate.unit_name}
                  </p>
                )}
                <p>
                  {candidate.email}
                  <br />
                  {candidate.phone}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="checklist-section">
          <div className="checklist-header">
            <h3 className="checklist-title">Checklist de Ações</h3>
          </div>

          <div className="checklist-items">
            {tasks.map((task) => (
              <div key={task.id} className="checklist-item">
                <input
                  type="checkbox"
                  checked={task.is_completed}
                  onChange={() => handleTaskToggle(task.id, task.is_completed)}
                  className="checklist-checkbox"
                />
                <div className="checklist-item-content">
                  <span className="checklist-text">{task.task_name}</span>
                  <div className="checklist-meta">
                    {task.due_date && (
                      <span className="checklist-due-date">
                        Prazo: {format(new Date(task.due_date), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTask} className="add-task-form">
            <div className="form-group">
              <input
                type="text"
                placeholder="Nova tarefa..."
                value={newTask.task_name}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, task_name: e.target.value }))
                }
                className="form-input"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) =>
                    setNewTask((prev) => ({
                      ...prev,
                      due_date: e.target.value,
                    }))
                  }
                  className="form-input"
                  required
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" className="form-button">
                Adicionar Tarefa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;
