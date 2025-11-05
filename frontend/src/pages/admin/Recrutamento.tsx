import React, { useEffect, useState, useCallback } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import KanbanStage, { Stage } from "./KanbanStage.tsx";
import { Candidate } from "./CandidateCard.tsx";

const Recrutamento: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Proteção de rota
  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [stagesRes, candidatesRes] = await Promise.all([
        api.get("/api/recruitment/stages"),
        api.get("/api/recruitment/candidates"),
      ]);
      setStages(stagesRes.data);
      setCandidates(candidatesRes.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados do recrutamento.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) fetchData();
  }, [user, loading, fetchData]);

  // Configuração do drag-and-drop
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const candidateId = active.id;
    const newStageId = Number(over.id);
    const candidate = candidates.find((c) => c.id === candidateId);

    if (!candidate || candidate.stage_id === newStageId) return;

    // Atualização otimista
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, stage_id: newStageId } : c
      )
    );

    try {
      await api.put(`/api/recruitment/candidate/${candidateId}/move`, {
        new_stage_id: newStageId,
      });
      toast.success("Candidato movido com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao mover candidato. Atualizando dados...");
      fetchData(); // Recarrega o estado do servidor
    }
  };

  if (isLoading || loading) {
    return (
      <div className="tela-loading">
        <p>Carregando recrutamento...</p>
      </div>
    );
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
