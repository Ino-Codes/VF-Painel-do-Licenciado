import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Module, Lesson } from "../../types.ts";
import { SortableLessonItem } from "./SortableLessonItem.tsx";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface SortableModuleItemProps {
  module: Module;
  onDeleteModule: (id: number) => void;
  onAddLesson: (moduleId: number) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: number) => void;
  onLessonOrderChange: (moduleId: number, orderedLessonIds: number[]) => void;
  setModules: React.Dispatch<React.SetStateAction<Module[]>>;
}

export const SortableModuleItem: React.FC<SortableModuleItemProps> = ({
  module,
  onDeleteModule,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onLessonOrderChange,
  setModules,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // `over` é null quando o item é solto fora de um alvo válido.
    if (!over || active.id === over.id) return;

    const lessons = module.lessons;
    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedLessons = arrayMove(lessons, oldIndex, newIndex);

    // Atualização imutável: novo array + novo objeto de módulo (sem mutar o estado anterior).
    setModules((prevModules) =>
      prevModules.map((m) =>
        m.id === module.id ? { ...m, lessons: reorderedLessons } : m,
      ),
    );

    onLessonOrderChange(
      module.id,
      reorderedLessons.map((l) => l.id),
    );
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="module-item">
      <div className="module-header">
        <span className="drag-handle" {...listeners}>
          ⠿
        </span>
        <h3>Módulo: {module.title}</h3>
        <button
          onClick={() => onDeleteModule(module.id)}
          className="delete-button"
        >
          Excluir Módulo
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleLessonDragEnd}
      >
        <SortableContext
          items={module.lessons.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="lesson-list">
            {module.lessons.map((lesson) => (
              <SortableLessonItem
                key={lesson.id}
                lesson={lesson}
                onEdit={onEditLesson}
                onDelete={onDeleteLesson}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="form-row module-add-lesson-row">
        <button
          className="form-button form-button--add"
          onClick={() => onAddLesson(module.id)}
        >
          + Adicionar Aula
        </button>
      </div>
    </div>
  );
};
