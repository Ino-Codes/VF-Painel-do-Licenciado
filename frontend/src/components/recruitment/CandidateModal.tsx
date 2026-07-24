import React, { useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import { format } from "date-fns";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import CandidateEditModal from "./CandidateEditModal.tsx";
import ChecklistEditModal from "./ChecklistEditModal.tsx";
import { IoCloseSharp } from "react-icons/io5";
import { FiTrash2, FiEdit } from "react-icons/fi";

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

  const formatPhone = (telefone?: string) => {
    if (!telefone) return "Não informado";
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length === 11) {
      return `(${digitos.substring(0, 2)}) ${digitos.substring(
        2,
        7
      )}-${digitos.substring(7)}`;
    }
    return telefone;
  };
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    task_name: "",
    responsible_user_id: candidate.user_id || "",
    due_date: format(new Date(), "yyyy-MM-dd"),
  });

  const api = useApi();

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/api/recruitment/candidates/${candidate.id}`);
      toast.success("Candidato excluído com sucesso!");
      setIsDeleteModalOpen(false);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Erro ao excluir candidato:", error);
      toast.error("Erro ao excluir o candidato. Tente novamente.");
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

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
          <IoCloseSharp />
        </button>
        <button className="modal-delete-button" onClick={handleDeleteClick}>
          <FiTrash2 />
        </button>
        <button
          className="modal-edit-button"
          onClick={() => setIsEditModalOpen(true)}
        >
          <FiEdit />
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
                {candidate.unit_name && (
                  <p>
                    {candidate.role_applied_for} · {candidate.unit_name}
                  </p>
                )}
                <p>{candidate.email}</p>
                <p>{formatPhone(candidate.phone)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="checklist-section">
          <div className="checklist-header">
            <h3 className="checklist-title">Checklist de Ações</h3>
            <div className="checklist-edit-action">
              <button
                className="list-button"
                onClick={() => setIsChecklistOpen(true)}
              >
                Editar Checklist
              </button>
            </div>
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
        </div>
      </div>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={`Excluir Candidato ${candidate.name}`}
        message="Tem certeza que deseja excluir este candidato? Esta ação não pode ser desfeita."
      />
      <CandidateEditModal
        candidate={candidate}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={() => {
          setIsEditModalOpen(false);
          onUpdate();
        }}
      />
      <ChecklistEditModal
        candidateId={candidate.id}
        tasks={tasks}
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        onChange={(updated) => setTasks(updated)}
      />
    </div>
  );
};

export default CandidateModal;
