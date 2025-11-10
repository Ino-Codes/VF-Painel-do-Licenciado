import React, { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useApi } from "../../hooks/useApi.ts";
import KanbanBoard from "../../components/recruitment/KanbanBoard.tsx";
import CandidateModal from "../../components/recruitment/CandidateModal.tsx";
import RecruitmentHeader from "../../components/recruitment/RecruitmentHeader.tsx";
import RecruitmentFilters from "../../components/recruitment/RecruitmentFilters.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";

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
        api.get("/api/recruitment/stages"),
        api.get("/api/recruitment/candidates", { params: filters }),
      ]);

      // Garante que temos arrays válidos mesmo se a resposta for vazia
      const loadedStages = stagesResponse.data || [];
      const loadedCandidates = candidatesResponse.data?.candidates || [];

      console.log("Stages:", loadedStages);
      console.log("Candidates:", loadedCandidates);

      setStages(loadedStages);
      setCandidates(loadedCandidates);
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
      await api.put(`/api/recruitment/candidates/${candidateId}/move`, {
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

  return (
    <div className="p-2">
      <Menu />
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

      <Footer />
    </div>
  );
};

export default Recruitment;
