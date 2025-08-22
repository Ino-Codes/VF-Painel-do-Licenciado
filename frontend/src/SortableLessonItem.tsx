import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lesson } from "./types.ts";

interface SortableLessonItemProps {
  lesson: Lesson;
  onEdit: (lesson: Lesson) => void;
  onDelete: (id: number) => void;
}

export const SortableLessonItem: React.FC<SortableLessonItemProps> = ({
  lesson,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners, // O 'ouvinte' dos eventos de arrastar
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // O ref, style e attributes continuam no elemento principal
    <li ref={setNodeRef} style={style} {...attributes} className="lesson-item">
      {/* A "Alça de Arrasto" (Drag Handle) */}
      {/* APENAS este elemento terá os 'listeners' */}
      <span className="drag-handle" {...listeners}>
        ⠿
      </span>

      <span>{lesson.title}</span>

      <div className="lesson-actions">
        {/* Estes botões agora funcionarão no primeiro clique */}
        <button type="button" onClick={() => onEdit(lesson)}>
          Editar
        </button>
        <button type="button" onClick={() => onDelete(lesson.id)}>
          Excluir
        </button>
      </div>
    </li>
  );
};
