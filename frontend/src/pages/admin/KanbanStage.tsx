// frontend/src/pages/admin/KanbanStage.tsx
import React from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import CandidateCard, { Candidate } from "./CandidateCard.tsx";

export interface Stage {
  id: number;
  name: string;
}

interface Props {
  stage: Stage;
  candidates: Candidate[];
}

const KanbanStage: React.FC<Props> = ({ stage, candidates }) => {
  const { setNodeRef } = useDroppable({ id: stage.id });

  return (
    <div className="kanban-stage">
      <h3>
        {stage.name} ({candidates.length})
      </h3>
      <SortableContext
        id={String(stage.id)}
        items={candidates.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="kanban-stage-tasks">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default KanbanStage;
