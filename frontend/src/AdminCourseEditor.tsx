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
import { Course, Module, Lesson } from "./types.ts";

const AdminCourseEditor: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const [itemToDelete, setItemToDelete] = useState<{
    type: "module" | "lesson";
    id: number;
  } | null>(null);
  const [lessonToEdit, setLessonToEdit] = useState<Partial<Lesson> | null>(
    null
  );
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);

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
      toast.error("Falha ao carregar detalhes do curso.");
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
        { title: newModuleTitle, module_order: newOrder },
        getAuthHeaders()
      );
      toast.success("Módulo adicionado!");
      setNewModuleTitle("");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar módulo.");
    }
  };

  const handleSaveLesson = async (
    lessonData: Omit<Lesson, "id" | "lesson_order">
  ) => {
    if (!course) return;

    try {
      if ("id" in lessonData && lessonData.id) {
        // Editando aula existente
        await api.put(
          `/api/admin/courses/lessons/${lessonData.id}`,
          lessonData,
          getAuthHeaders()
        );
        toast.success("Aula atualizada com sucesso!");
      } else {
        // Criando nova aula
        const module = course.modules.find((m) => m.id === activeModuleId);
        if (!module) {
          toast.error("Módulo não encontrado para adicionar a aula.");
          return;
        }
        const newOrder = module.lessons.length + 1;
        const newLessonData = { ...lessonData, lesson_order: newOrder };
        await api.post(
          `/api/admin/courses/modules/${module.id}/lessons`,
          newLessonData,
          getAuthHeaders()
        );
        toast.success("Aula adicionada com sucesso!");
      }
      setLessonToEdit(null);
      setActiveModuleId(null);
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao salvar a aula.");
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
      fetchCourseDetails(); // Recarrega os dados
    } catch (err) {
      toast.error(`Erro ao excluir ${type}.`);
    } finally {
      setItemToDelete(null); // Fecha o modal
    }
  };

  const openAddLessonModal = (moduleId: number) => {
    setActiveModuleId(moduleId);
    setLessonToEdit({}); // Abre o modal com um objeto vazio para 'criar'
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;

    // 1. Verifica se o item foi solto fora de uma área válida
    if (!destination || !course) {
      return;
    }

    // 2. Garante que o item foi solto na mesma posição em que começou
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // 3. Lógica para reordenar MÓDULOS
    if (type === "MODULE") {
      // Cria uma cópia reordenável da lista de módulos
      const reorderedModules = Array.from(course.modules);

      // Remove o módulo da sua posição original
      const [movedModule] = reorderedModules.splice(source.index, 1);

      // Insere o módulo na sua nova posição
      reorderedModules.splice(destination.index, 0, movedModule);

      // Atualiza o estado local para o usuário ver a mudança instantaneamente (Atualização Otimista)
      setCourse({ ...course, modules: reorderedModules });

      // Prepara os dados para enviar à API (apenas um array de IDs na nova ordem)
      const orderedModuleIds = reorderedModules.map((m) => m.id);

      try {
        // Envia a nova ordem para o backend
        await api.put(
          `/api/admin/courses/${courseId}/modules/order`,
          { orderedModuleIds },
          getAuthHeaders()
        );
        toast.success("Ordem dos módulos salva com sucesso!");
      } catch (err) {
        toast.error("Falha ao salvar a nova ordem dos módulos.");
        // Se a API falhar, busca os dados originais para reverter a mudança na tela
        fetchCourseDetails();
      }
    }

    // Futuramente, aqui podemos adicionar a lógica para reordenar AULAS
    // if (type === 'LESSON') { ... }
  };

  if (loading || !course) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
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
                                <button onClick={() => setLessonToEdit(lesson)}>
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
                        <div className="form-row" style={{ marginTop: "15px" }}>
                          <button
                            className="form-button"
                            onClick={() => openAddLessonModal(module.id)}
                          >
                            + Adicionar Aula
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
      <Footer />

      {lessonToEdit && (
        <LessonEditModal
          lesson={lessonToEdit}
          onClose={() => {
            setLessonToEdit(null);
            setActiveModuleId(null);
          }}
          onSave={handleSaveLesson}
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
