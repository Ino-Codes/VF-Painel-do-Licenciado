import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import LessonEditModal from "./LessonEditModal.tsx";

// Interfaces
interface Lesson {
  id: number;
  title: string;
  content_type: "video" | "text";
  content_data: string;
  lesson_order: number;
}
interface Module {
  id: number;
  title: string;
  module_order: number;
  lessons: Lesson[];
}
interface Course {
  id: number;
  title: string;
  modules: Module[];
}

const AdminCourseEditor: React.FC = () => {
  // --- MUDANÇA 1: Adicionar 'loading' do useAuth ---
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitles, setNewLessonTitles] = useState<{
    [key: number]: string;
  }>({});

  const [itemToDelete, setItemToDelete] = useState<{
    type: "module" | "lesson";
    id: number;
  } | null>(null);
  const [lessonToEdit, setLessonToEdit] = useState<Lesson | null>(null);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourseDetails = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const res = await api.get(
        `/api/admin/courses/${courseId}`,
        getAuthHeaders()
      );
      setCourse(res.data);
    } catch (err) {
      toast.error("Falha ao carregar detalhes da trilha.");
      navigate("/admin/courses");
    }
  }, [user, courseId, getAuthHeaders, navigate]);

  useEffect(() => {
    if (user) {
      fetchCourseDetails();
    }
  }, [user, fetchCourseDetails]);

  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !course) return;
    try {
      const newOrder = course.modules.length + 1;
      await api.post(
        `/api/admin/courses/${course.id}/modules`,
        {
          title: newModuleTitle,
          module_order: newOrder,
        },
        getAuthHeaders()
      );
      toast.success("Módulo adicionado!");
      setNewModuleTitle("");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar módulo.");
    }
  };

  const handleAddLesson = async (moduleId: number) => {
    const lessonTitle = newLessonTitles[moduleId];
    const module = course?.modules.find((m) => m.id === moduleId);
    if (!lessonTitle || !lessonTitle.trim() || !module) return;
    try {
      const newOrder = module.lessons.length + 1;
      await api.post(
        `/api/admin/courses/modules/${moduleId}/lessons`,
        {
          title: lessonTitle,
          content_type: "video",
          content_data: "",
          lesson_order: newOrder,
        },
        getAuthHeaders()
      );
      toast.success("Aula adicionada!");
      setNewLessonTitles({ ...newLessonTitles, [moduleId]: "" });
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar aula.");
    }
  };

  const handleDeleteClick = (type: "module" | "lesson", id: number) =>
    setItemToDelete({ type, id });

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { type, id } = itemToDelete;
    const url =
      type === "module"
        ? `/api/admin/courses/modules/${id}`
        : `/api/admin/courses/lessons/${id}`;
    try {
      await api.delete(url, getAuthHeaders());
      toast.success(
        `${type === "module" ? "Módulo" : "Aula"} excluído com sucesso!`
      );
      fetchCourseDetails();
    } catch (err) {
      toast.error(`Erro ao excluir ${type}.`);
    } finally {
      setItemToDelete(null);
    }
  };

  const handleUpdateLesson = async (updatedLesson: Lesson) => {
    try {
      await api.put(
        `/api/admin/courses/lessons/${updatedLesson.id}`,
        updatedLesson,
        getAuthHeaders()
      );
      toast.success("Aula atualizada com sucesso!");
      setLessonToEdit(null);
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao atualizar aula.");
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination || !course) return;

    if (type === "MODULE") {
      const reorderedModules = Array.from(course.modules);
      const [movedModule] = reorderedModules.splice(source.index, 1);
      reorderedModules.splice(destination.index, 0, movedModule);

      setCourse({ ...course, modules: reorderedModules });

      const orderedModuleIds = reorderedModules.map((m) => m.id);
      try {
        await api.put(
          `/api/admin/courses/${courseId}/modules/order`,
          { orderedModuleIds },
          getAuthHeaders()
        );
        toast.success("Ordem dos módulos salva!");
      } catch (err) {
        toast.error("Falha ao salvar a nova ordem dos módulos.");
        fetchCourseDetails();
      }
    }
  };

  // --- MUDANÇA 2: Adicionar verificação de 'loading' ---
  // Garante que a autenticação foi concluída antes de tentar renderizar
  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }

  // Esta verificação agora acontece depois de sabermos que a autenticação não está mais carregando
  if (!course) {
    return <div className="tela-loading">Carregando dados da trilha...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="content-area">
          <button
            onClick={() => navigate("/admin/courses")}
            className="form-button-cancel mb-4"
          >
            &larr; Voltar
          </button>
          <h2>Editor da Trilha: {course.title}</h2>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-modules" type="MODULE">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="modules-list"
                >
                  {course.modules.map((module, index) => (
                    <Draggable
                      key={module.id}
                      draggableId={String(module.id)}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="module-item"
                        >
                          <div className="module-header">
                            <h3>Módulo: {module.title}</h3>
                            <button
                              onClick={() =>
                                handleDeleteClick("module", module.id)
                              }
                              className="delete-button"
                            >
                              Excluir Módulo
                            </button>
                          </div>
                          <ul className="lesson-list">
                            {module.lessons.map((lesson) => (
                              <li key={lesson.id} className="lesson-item">
                                <span>{lesson.title}</span>
                                <div className="lesson-actions">
                                  <button
                                    onClick={() => setLessonToEdit(lesson)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteClick("lesson", lesson.id)
                                    }
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className="add-lesson-form">
                            <input
                              type="text"
                              placeholder="Título da nova aula"
                              value={newLessonTitles[module.id] || ""}
                              onChange={(e) =>
                                setNewLessonTitles({
                                  ...newLessonTitles,
                                  [module.id]: e.target.value,
                                })
                              }
                            />
                            <button onClick={() => handleAddLesson(module.id)}>
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="admin-form mt-4">
            <h3>Adicionar Novo Módulo</h3>
            <div className="form-row">
              <input
                className="form-input"
                type="text"
                placeholder="Título do novo módulo"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
              />
              <button
                className="form-button"
                type="button"
                onClick={handleAddModule}
              >
                Adicionar Módulo
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {lessonToEdit && (
        <LessonEditModal
          lesson={lessonToEdit}
          onClose={() => setLessonToEdit(null)}
          onSave={handleUpdateLesson}
        />
      )}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir este item? ${
          itemToDelete?.type === "module"
            ? "Todas as aulas dentro dele serão perdidas."
            : ""
        }`}
      />
    </div>
  );
};

export default AdminCourseEditor;
