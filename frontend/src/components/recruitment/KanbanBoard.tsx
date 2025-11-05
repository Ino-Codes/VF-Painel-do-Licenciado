import React from "react";
import KanbanColumn from "./KanbanColumn.tsx";
import { Candidate, Stage } from "../../types/recruitment.ts";

interface KanbanBoardProps {
  stages: Stage[];
  candidates: Candidate[];
  onDragEnd: (candidateId: number, newStageId: number) => void;
  onCandidateClick: (candidate: Candidate) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  stages,
  candidates,
  onDragEnd,
  onCandidateClick,
}) => {
  const sortedStages = [...stages].sort(
    (a, b) => a.stage_order - b.stage_order
  );

  return (
    <div className="kanban-container">
      <div className="kanban-board">
        {sortedStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stageId={stage.id}
            title={stage.name}
            candidates={candidates}
            onDragEnd={onDragEnd}
            onCandidateClick={onCandidateClick}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
