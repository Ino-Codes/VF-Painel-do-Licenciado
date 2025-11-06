import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdFormatListBulleted } from "react-icons/md";
import NewCandidateModal from "./NewCandidateModal.tsx";
import StagesModal from "./StagesModal.tsx";

interface RecruitmentHeaderProps {
  onRefresh: () => void;
}

const RecruitmentHeader: React.FC<RecruitmentHeaderProps> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const [isNewCandidateModalOpen, setIsNewCandidateModalOpen] = useState(false);
  const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);

  return (
    <div className="recruitment-header">
      <h1 className="recruitment-title">Gestão de Recrutamento</h1>
      <div className="recruitment-actions">
        <button
          className="form-button"
          onClick={() => setIsNewCandidateModalOpen(true)}
        >
          Novo Candidato
        </button>
        <button
          className="form-button"
          onClick={() => setIsStagesModalOpen(true)}
        >
          Gerenciar Etapas
        </button>
        <button
          className="form-button"
          onClick={() => navigate("/admin/checklist-templates")}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <MdFormatListBulleted size={20} />
          Gerenciar Tarefas
        </button>
      </div>

      {isNewCandidateModalOpen && (
        <NewCandidateModal
          onClose={() => setIsNewCandidateModalOpen(false)}
          onSave={onRefresh}
        />
      )}

      {isStagesModalOpen && (
        <StagesModal
          onClose={() => setIsStagesModalOpen(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
};

export default RecruitmentHeader;
