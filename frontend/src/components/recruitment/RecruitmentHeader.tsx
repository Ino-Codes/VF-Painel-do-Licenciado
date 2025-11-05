import React from "react";

interface RecruitmentHeaderProps {
  onRefresh: () => void;
}

const RecruitmentHeader: React.FC<RecruitmentHeaderProps> = ({ onRefresh }) => {
  return (
    <div className="recruitment-header">
      <h1 className="recruitment-title">Gestão de Recrutamento</h1>
      <div className="recruitment-actions">
        <button className="form-button" onClick={onRefresh}>
          Atualizar
        </button>
        {/* Adicione mais botões de ação aqui se necessário */}
      </div>
    </div>
  );
};

export default RecruitmentHeader;
