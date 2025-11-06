import React, { useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { Task } from "../../types/recruitment.ts";
import { IoCloseSharp } from "react-icons/io5";

interface Props {
  candidateId: number;
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onChange: (tasks: Task[]) => void;
}

const ChecklistEditModal: React.FC<Props> = ({
  candidateId,
  tasks,
  isOpen,
  onClose,
  onChange,
}) => {
  const api = useApi();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks || []);
  const [newTaskName, setNewTaskName] = useState("");

  // sync when tasks prop changes
  React.useEffect(() => setLocalTasks(tasks || []), [tasks]);

  if (!isOpen) return null;

  const handleSaveLocal = () => {
    onChange(localTasks);
    onClose();
  };

  const handleDelete = async (taskId: number) => {
    try {
      await api.delete(`/api/recruitment/tasks/${taskId}`);
      const updated = localTasks.filter((t) => t.id !== taskId);
      setLocalTasks(updated);
      onChange(updated);
      toast.success("Tarefa excluída");
    } catch (err) {
      console.error("Erro ao deletar tarefa:", err);
      toast.error("Erro ao excluir tarefa");
    }
  };

  const handleAdd = async () => {
    if (!newTaskName.trim()) return;
    try {
      const res = await api.post(
        `/api/recruitment/candidates/${candidateId}/tasks`,
        {
          task_name: newTaskName,
        }
      );
      setLocalTasks((p) => [...p, res.data]);
      onChange([...localTasks, res.data]);
      setNewTaskName("");
      toast.success("Tarefa adicionada");
    } catch (err) {
      console.error("Erro ao adicionar tarefa:", err);
      toast.error("Erro ao adicionar tarefa");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const res = await api.put(`/api/recruitment/tasks/${task.id}`, {
        is_completed: !task.is_completed,
      });
      setLocalTasks((p) => p.map((t) => (t.id === task.id ? res.data : t)));
      onChange(localTasks.map((t) => (t.id === task.id ? res.data : t)));
    } catch (err) {
      console.error("Erro ao atualizar tarefa:", err);
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          <IoCloseSharp />
        </button>
        <h3>Editar Checklist</h3>

        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {localTasks.map((task) => (
            <div
              key={task.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="checkbox"
                checked={task.is_completed}
                onChange={() => handleToggleComplete(task)}
              />
              <span style={{ flex: 1 }}>{task.task_name}</span>
              <button
                className="delete-button"
                onClick={() => handleDelete(task.id)}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="form-input"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="Nova tarefa"
          />
          <button type="button" className="form-button" onClick={handleAdd}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChecklistEditModal;
