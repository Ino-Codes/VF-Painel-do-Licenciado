import React, { useState } from "react";
import NewCandidateModal from "./NewCandidateModal.tsx";
import StagesModal from "./StagesModal.tsx";

interface RecruitmentHeaderProps {
  onRefresh: () => void;
}

const RecruitmentHeader: React.FC<RecruitmentHeaderProps> = ({ onRefresh }) => {
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
