import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTasks } from "react-icons/fa";
import { FaUserPlus, FaTableColumns } from "react-icons/fa6";
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
          className="form-button btn-icon-text"
          onClick={() => setIsNewCandidateModalOpen(true)}
        >
          <FaUserPlus size={20} />
          Novo Candidato
        </button>
        <button
          className="form-button btn-icon-text"
          onClick={() => setIsStagesModalOpen(true)}
        >
          <FaTableColumns size={20} />
          Gerenciar Etapas
        </button>
        <button
          className="form-button btn-icon-text"
          onClick={() => navigate("/admin/checklist-templates")}
        >
          <FaTasks size={20} />
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
