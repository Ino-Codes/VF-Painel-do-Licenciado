import React, { useRef } from "react";
import { useDrop } from "react-dnd";
import CandidateCard from "./CandidateCard.tsx";
import { Candidate } from "../../types/recruitment";
import type { Identifier } from "dnd-core";

interface KanbanColumnProps {
  stageId: number;
  title: string;
  candidates: Candidate[];
  onDragEnd: (candidateId: number, newStageId: number) => void;
  onCandidateClick: (candidate: Candidate) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stageId,
  title,
  candidates,
  onDragEnd,
  onCandidateClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver }, dropRef] = useDrop<
    { id: number; type: string },
    void,
    { isOver: boolean }
  >({
    accept: "CANDIDATE",
    drop: (item) => {
      onDragEnd(item.id, stageId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  dropRef(ref);

  const stageSpecificCandidates = candidates.filter(
    (candidate) => candidate.stage_id === stageId
  );

  return (
    <div ref={ref} className={`kanban-column ${isOver ? "drag-over" : ""}`}>
      <div className="kanban-column-header">
        <h3 className="kanban-column-title">{title}</h3>
        <span className="kanban-column-count">
          {stageSpecificCandidates.length}
        </span>
      </div>
      <div className="kanban-cards">
        {stageSpecificCandidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            id={candidate.id}
            name={candidate.name}
            role_applied_for={candidate.role_applied_for}
            tasks={candidate.tasks}
            onClick={() => onCandidateClick(candidate)}
          />
        ))}
      </div>
    </div>
  );
};

export default KanbanColumn;
