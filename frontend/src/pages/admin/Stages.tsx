import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";

// ---- Interfaces ----
interface Stage {
  id: number;
  name: string;
  stage_order: number;
}

// ---- Component interno para cada linha (reordenável) ----
const SortableStageRow: React.FC<{
  stage: Stage;
  onEdit: (s: Stage) => void;
  onDelete: (id: number) => void;
  isEditing: boolean;
  editingStage: Stage | null;
  setEditingStage: React.Dispatch<React.SetStateAction<Stage | null>>;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}> = ({
  stage,
  onEdit,
  onDelete,
  isEditing,
  editingStage,
  setEditingStage,
  onSaveEdit,
  onCancelEdit,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <td data-label="Ordem" style={{ cursor: "grab", width: "50px" }}>
        ☰
      </td>
      <td data-label="Nome da Etapa">
        {isEditing ? (
          <input
            className="form-input"
            value={editingStage?.name || ""}
            onChange={(e) =>
              setEditingStage({ ...stage, name: e.target.value })
            }
          />
        ) : (
          stage.name
        )}
      </td>
      <td data-label="Ações">
        <div className="user-actions">
          {isEditing ? (
            <>
              <button className="list-button" onClick={onSaveEdit}>
                Salvar
              </button>
              <button className="form-button-cancel" onClick={onCancelEdit}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button className="list-button" onClick={() => onEdit(stage)}>
                Editar
              </button>
              <button
                className="delete-button"
                onClick={() => onDelete(stage.id)}
              >
                Excluir
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// ---- Componente principal ----
const Stages: React.FC = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStage, setNewStage] = useState("");
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // ---- Carregar etapas ----
  const fetchStages = async () => {
    try {
      const res = await api.get("/recruitment/stages");
      setStages(res.data);
    } catch {
      toast.error("Erro ao carregar etapas.");
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  // ---- Criar nova etapa ----
  const handleCreateStage = async () => {
    if (!newStage.trim()) return toast.error("Digite o nome da etapa.");
    await api.post("/recruitment/stages", { name: newStage });
    setNewStage("");
    fetchStages();
  };

  // ---- Atualizar etapa ----
  const handleUpdateStage = async () => {
    if (!editingStage || !editingStage.name.trim())
      return toast.error("Digite o nome da etapa.");
    await api.put(`/recruitment/stages/${editingStage.id}`, {
      name: editingStage.name,
    });
    toast.success("Etapa atualizada!");
    setEditingStage(null);
    fetchStages();
  };

  // ---- Excluir etapa ----
  const handleDeleteStage = async (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta etapa?")) {
      await api.delete(`/recruitment/stages/${id}`);
      fetchStages();
    }
  };

  // ---- Drag & Drop: ao soltar ----
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const newOrder = arrayMove(stages, oldIndex, newIndex).map((s, index) => ({
      ...s,
      stage_order: index + 1,
    }));

    setStages(newOrder);

    try {
      await api.put("/recruitment/stages/reorder", {
        order: newOrder.map((s) => ({ id: s.id, stage_order: s.stage_order })),
      });
      toast.success("Ordem atualizada!");
    } catch {
      toast.error("Erro ao salvar nova ordem.");
      fetchStages();
    }
  };

  return (
    <div className="content-area">
      <h2>Gestão de Etapas do Recrutamento</h2>
      <p>Organize, renomeie e reordene as etapas do funil de seleção.</p>

      {/* Formulário de criação */}
      <div
        className="admin-form"
        style={{ padding: "20px", marginTop: "20px" }}
      >
        <div className="form-row">
          <input
            className="form-input"
            placeholder="Nova etapa..."
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
          />
          <button className="form-button" onClick={handleCreateStage}>
            Adicionar
          </button>
        </div>
      </div>

      {/* Tabela de Etapas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={stages.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <table className="admin-table" style={{ marginTop: "20px" }}>
            <thead>
              <tr>
                <th style={{ width: "50px" }}>⇅</th>
                <th>Nome da Etapa</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  isEditing={editingStage?.id === stage.id}
                  editingStage={editingStage}
                  setEditingStage={setEditingStage}
                  onEdit={(s) => setEditingStage(s)}
                  onDelete={handleDeleteStage}
                  onSaveEdit={handleUpdateStage}
                  onCancelEdit={() => setEditingStage(null)}
                />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>

      {stages.length === 0 && (
        <div className="empty-state-container">
          <img
            src="https://cdn-icons-png.flaticon.com/512/4076/4076505.png"
            alt="Sem etapas"
            className="empty-state-image"
          />
          <h3 className="empty-state-title">Nenhuma etapa cadastrada</h3>
          <p className="empty-state-message">
            Crie uma nova etapa para começar a organizar seu processo seletivo.
          </p>
        </div>
      )}
    </div>
  );
};

export default Stages;
