import React, { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { Stage } from "../../types/recruitment.ts";

interface StagesModalProps {
  onClose: () => void;
  onSave: () => void;
}

const StagesModal: React.FC<StagesModalProps> = ({ onClose, onSave }) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStageName, setNewStageName] = useState("");

  const api = useApi();

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    try {
      const response = await api.get("/api/recruitment/stages");
      setStages(response.data);
    } catch (error) {
      console.error("Erro ao carregar etapas:", error);
      toast.error("Erro ao carregar etapas");
    }
  };

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    try {
      await api.post("/api/recruitment/stages", {
        name: newStageName,
        stage_order: stages.length + 1,
        pipeline_type: "Recrutamento",
      });

      toast.success("Etapa adicionada com sucesso!");
      setNewStageName("");
      loadStages();
      onSave();
    } catch (error) {
      console.error("Erro ao adicionar etapa:", error);
      toast.error("Erro ao adicionar etapa");
    }
  };

  const handleDeleteStage = async (stageId: number) => {
    try {
      await api.delete(`/api/recruitment/stages/${stageId}`);
      toast.success("Etapa removida com sucesso!");
      loadStages();
      onSave();
    } catch (error) {
      console.error("Erro ao remover etapa:", error);
      toast.error("Erro ao remover etapa");
    }
  };

  const handleMoveStage = async (stageId: number, direction: "up" | "down") => {
    const stageIndex = stages.findIndex((s) => s.id === stageId);
    if (
      (direction === "up" && stageIndex === 0) ||
      (direction === "down" && stageIndex === stages.length - 1)
    )
      return;

    try {
      // Reordena localmente primeiro
      const newStages = [...stages];
      const swapIndex = direction === "up" ? stageIndex - 1 : stageIndex + 1;

      // Troca as posições
      [newStages[stageIndex], newStages[swapIndex]] = [
        newStages[swapIndex],
        newStages[stageIndex],
      ];

      // Atualiza as ordens
      const updatedStages = newStages.map((stage, index) => ({
        id: stage.id,
        stage_order: index + 1,
      }));

      // Envia para a API
      await api.put("/api/recruitment/stages/reorder", {
        stages: updatedStages,
      });

      loadStages();
      onSave();
    } catch (error) {
      console.error("Erro ao reordenar etapa:", error);
      toast.error("Erro ao reordenar etapa");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content stages-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>

        <h2 className="modal-title">Gerenciar Etapas</h2>

        <div className="stages-list">
          {stages.map((stage, index) => (
            <div key={stage.id} className="stage-item">
              <span className="stage-name">{stage.name}</span>
              <div className="stage-actions">
                <button
                  onClick={() => handleMoveStage(stage.id, "up")}
                  disabled={index === 0}
                  className="icon-button"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoveStage(stage.id, "down")}
                  disabled={index === stages.length - 1}
                  className="icon-button"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDeleteStage(stage.id)}
                  className="icon-button delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddStage} className="add-stage-form">
          <div className="form-group">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Nova etapa..."
              className="form-input"
            />
          </div>
          <button type="submit" className="form-button">
            Adicionar Etapa
          </button>
        </form>
      </div>
    </div>
  );
};

export default StagesModal;
