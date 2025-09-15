import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lesson } from "../../types.ts";

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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} className="lesson-item">
      <span className="drag-handle" {...listeners}>
        ⠿
      </span>

      <span>{lesson.title}</span>

      <div className="lesson-actions">
        <button
          className="list-button"
          type="button"
          onClick={() => onEdit(lesson)}
        >
          Editar
        </button>
        <button
          className="delete-button"
          type="button"
          onClick={() => onDelete(lesson.id)}
        >
          Excluir
        </button>
      </div>
    </li>
  );
};
