import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Module, Lesson } from "./types.ts";
import { SortableLessonItem } from "./SortableLessonItem.tsx";
// Precisamos importar o DndContext e outros hooks aqui também para a lista interna de aulas
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  setModules: React.Dispatch<React.SetStateAction<Module[]>>; // Para atualizar o estado local
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
  // Configuração do dnd-kit para a lista de Módulos (externa)
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Configuração do dnd-kit para a lista de Aulas (interna)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleLessonDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      // Atualiza o estado local para feedback visual imediato
      setModules((prevModules) => {
        const newModules = [...prevModules];
        const moduleIndex = newModules.findIndex((m) => m.id === module.id);
        const lessons = newModules[moduleIndex].lessons;
        const oldIndex = lessons.findIndex((l) => l.id === active.id);
        const newIndex = lessons.findIndex((l) => l.id === over.id);
        newModules[moduleIndex].lessons = arrayMove(
          lessons,
          oldIndex,
          newIndex
        );
        return newModules;
      });

      // Envia a nova ordem para a API
      const reorderedLessons = arrayMove(
        module.lessons,
        module.lessons.findIndex((l) => l.id === active.id),
        module.lessons.findIndex((l) => l.id === over.id)
      );
      const orderedLessonIds = reorderedLessons.map((l) => l.id);
      onLessonOrderChange(module.id, orderedLessonIds);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="module-item">
      <div
        className="module-header"
        {...attributes}
        {...listeners}
        style={{ cursor: "grab" }}
      >
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

      <div className="form-row" style={{ marginTop: "15px" }}>
        <button className="form-button" onClick={() => onAddLesson(module.id)}>
          + Adicionar Aula
        </button>
      </div>
    </div>
  );
};
