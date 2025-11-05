// frontend/src/pages/admin/CandidateCard.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface Candidate {
  id: number;
  name: string;
  role_applied_for: string;
  stage_id: number;
  // Adicione outros campos se necessário
}

interface Props {
  candidate: Candidate;
}

const CandidateCard: React.FC<Props> = ({ candidate }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="kanban-card"
    >
      <h4>{candidate.name}</h4>
      <p>{candidate.role_applied_for}</p>
    </div>
  );
};

export default CandidateCard;
