// frontend/src/pages/admin/Recrutamento.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import KanbanStage, { Stage } from "./KanbanStage.tsx";
import { Candidate } from "./CandidateCard.tsx";

const Recrutamento: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchData = useCallback(async () => {
    try {
      const [stagesRes, candidatesRes] = await Promise.all([
        api.get("/api/recruitment/stages"),
        api.get("/api/recruitment/candidates"),
      ]);
      setStages(stagesRes.data);
      setCandidates(candidatesRes.data);
    } catch (err) {
      toast.error("Erro ao carregar dados do quadro.");
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return; // Se largar fora de uma coluna

    const activeStageId = candidates.find((c) => c.id === active.id)?.stage_id;
    const overStageId = over.id;

    if (activeStageId !== overStageId) {
      // Otimisticamente atualiza o estado local
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === active.id ? { ...c, stage_id: Number(overStageId) } : c
        )
      );

      // Envia a alteração para a API
      api
        .put(`/api/recruitment/candidate/${active.id}/move`, {
          new_stage_id: overStageId,
        })
        .then(() => {
          toast.success("Candidato movido!");
        })
        .catch((err) => {
          toast.error("Erro ao mover candidato. Revertendo.");
          fetchData(); // Reverte para o estado do servidor
        });
    }
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Recrutamento e Onboarding</h2>
          <p>Arraste os candidatos entre as etapas do funil.</p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {stages.map((stage) => (
              <KanbanStage
                key={stage.id}
                stage={stage}
                candidates={candidates.filter((c) => c.stage_id === stage.id)}
              />
            ))}
          </div>
        </DndContext>
      </div>
      <Footer />
    </div>
  );
};

export default Recrutamento;
