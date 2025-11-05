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

type PipelineType = "Recrutamento" | "Onboarding";
const Recrutamento: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [currentPipeline, setCurrentPipeline] =
    useState<PipelineType>("Recrutamento");

  // 🔒 Restrição de acesso
  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // 🔄 Buscar dados
  const fetchData = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [stagesRes, candidatesRes] = await Promise.all([
        api.get(`/api/recruitment/stages?pipeline_type=${currentPipeline}`),
        api.get(`/api/recruitment/candidates?pipeline_type=${currentPipeline}`),
      ]);
      setStages(stagesRes.data);
      setCandidates(candidatesRes.data);
    } catch (err) {
      toast.error(`Erro ao carregar dados de ${currentPipeline}.`);
    } finally {
      setRefreshing(false);
    }
  }, [currentPipeline, user]);

  useEffect(() => {
    fetchData();
  }, [currentPipeline, fetchData]);

  const sensors = useSensors(useSensor(PointerSensor));

  // 🧩 Quando soltar um candidato em nova etapa
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCandidate = candidates.find((c) => c.id === active.id);
    const newStageId = Number(over.id);

    if (!activeCandidate || activeCandidate.stage_id === newStageId) return;

    // Atualiza localmente
    setCandidates((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, stage_id: newStageId } : c))
    );

    // Persiste no backend
    api
      .put(`/api/recruitment/candidate/${active.id}/move`, {
        new_stage_id: newStageId,
      })
      .then(() => toast.success("Candidato movido!"))
      .catch(() => {
        toast.error("Erro ao mover candidato. Revertendo...");
        fetchData();
      });
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />

      <div className="content-area">
        <div
          className="page-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2>Recrutamento e Onboarding</h2>
            <p>Arraste os candidatos entre as etapas do funil.</p>

            <div className="pipeline-selector">
              <label>
                <input
                  type="radio"
                  name="pipeline"
                  value="Recrutamento"
                  checked={currentPipeline === "Recrutamento"}
                  onChange={() => setCurrentPipeline("Recrutamento")}
                />
                Recrutamento
              </label>
              <label>
                <input
                  type="radio"
                  name="pipeline"
                  value="Onboarding"
                  checked={currentPipeline === "Onboarding"}
                  onChange={() => setCurrentPipeline("Onboarding")}
                />
                Onboarding
              </label>
            </div>
          </div>
          <div className="page-header-actions">
            <button className="form-button">➕ Adicionar Candidato</button>
            <button className="form-button-secondary">Nova Etapa</button>
            <button
              className="list-button"
              onClick={fetchData}
              disabled={refreshing}
            >
              {refreshing ? "Atualizando..." : "🔄"}
            </button>
          </div>
        </div>

        {stages.length === 0 ? (
          <div className="empty-state-container">
            <img
              src="https://cdn-icons-png.flaticon.com/512/4076/4076505.png"
              alt="Sem etapas"
              className="empty-state-image"
            />
            <h3 className="empty-state-title">
              Nenhuma etapa para "{currentPipeline}"
            </h3>
            <p className="empty-state-message">
              Use o botão "Nova Etapa" para começar a organizar seu processo.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div
              className="kanban-board"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${stages.length}, 1fr)`,
                gap: "20px",
                overflowX: "auto",
                paddingBottom: "20px",
              }}
            >
              {stages.map((stage) => (
                <KanbanStage
                  key={stage.id}
                  stage={stage}
                  candidates={candidates.filter((c) => c.stage_id === stage.id)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Recrutamento;
