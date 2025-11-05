import React, { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useApi } from "../../hooks/useApi.ts";
import KanbanBoard from "../../components/recruitment/KanbanBoard.tsx";
import CandidateModal from "../../components/recruitment/CandidateModal.tsx";
import RecruitmentHeader from "../../components/recruitment/RecruitmentHeader.tsx";
import RecruitmentFilters from "../../components/recruitment/RecruitmentFilters.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

interface Stage {
  id: number;
  name: string;
  stage_order: number;
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
  stage_name?: string;
  responsible_name?: string;
  tasks?: Task[];
}

interface Task {
  id: number;
  task_name: string;
  is_completed: boolean;
  responsible_user_id: number;
  due_date: string;
}

interface Filter {
  search: string;
  stage_id: string;
  role_applied_for: string;
  status: string;
}

const Recruitment: React.FC = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );
  const [filters, setFilters] = useState<Filter>({
    search: "",
    stage_id: "",
    role_applied_for: "",
    status: "",
  });

  const api = useApi();

  const loadData = async () => {
    try {
      setLoading(true);
      const [stagesResponse, candidatesResponse] = await Promise.all([
        api.get("/recruitment/stages"),
        api.get("/recruitment/candidates", { params: filters }),
      ]);

      setStages(stagesResponse.data);
      setCandidates(candidatesResponse.data.candidates);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleDragEnd = async (candidateId: number, newStageId: number) => {
    try {
      await api.put(`/recruitment/candidates/${candidateId}/move`, {
        stage_id: newStageId,
      });

      // Atualiza o estado local
      setCandidates((prevCandidates) =>
        prevCandidates.map((candidate) =>
          candidate.id === candidateId
            ? { ...candidate, stage_id: newStageId }
            : candidate
        )
      );
    } catch (error) {
      console.error("Erro ao mover candidato:", error);
    }
  };

  const handleCandidateClick = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleCloseModal = () => {
    setSelectedCandidate(null);
    loadData(); // Recarrega os dados para atualizar qualquer mudança
  };

  const handleFilterChange = (newFilters: Partial<Filter>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="content-area">
      <RecruitmentHeader onRefresh={loadData} />

      <RecruitmentFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        stages={stages}
      />

      <DndProvider backend={HTML5Backend}>
        <KanbanBoard
          stages={stages}
          candidates={candidates}
          onDragEnd={handleDragEnd}
          onCandidateClick={handleCandidateClick}
        />
      </DndProvider>

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={handleCloseModal}
          onUpdate={loadData}
        />
      )}
    </div>
  );
};

export default Recruitment;
