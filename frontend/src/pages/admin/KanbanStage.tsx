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
      <div className="kanban-stage-header">
        <h3>
          {stage.name} <span>({candidates.length})</span>
        </h3>
      </div>

      <SortableContext
        id={String(stage.id)}
        items={candidates.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="kanban-stage-body">
          {candidates.length > 0 ? (
            candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))
          ) : (
            <p className="kanban-empty">Nenhum candidato</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default KanbanStage;
