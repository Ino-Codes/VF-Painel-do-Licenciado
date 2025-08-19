import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import LessonEditModal from "./LessonEditModal.tsx"; // Importa o novo modal
import { Course, Module, Lesson } from "./types.ts";

const AdminCourseEditor: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitles, setNewLessonTitles] = useState<{
    [key: number]: string;
  }>({});

  // Novos estados para controlar os modais
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
    if (user) fetchCourseDetails();
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

  // --- NOVAS FUNÇÕES ---
  const handleDeleteClick = (type: "module" | "lesson", id: number) => {
    setItemToDelete({ type, id });
  };

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

  const handleUpdateLesson = async (updatedLesson: Lesson) => {
    try {
      await api.put(
        `/api/admin/courses/lessons/${updatedLesson.id}`,
        updatedLesson,
        getAuthHeaders()
      );
      toast.success("Aula atualizada com sucesso!");
      setLessonToEdit(null); // Fecha o modal
      fetchCourseDetails(); // Recarrega os dados
    } catch (err) {
      toast.error("Erro ao atualizar aula.");
    }
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
          &larr; Voltar para todas as trilhas
        </button>

        <h2>Editor da Trilha: {course.title}</h2>

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
            <button className="form-button" onClick={handleAddModule}>
              Adicionar Módulo
            </button>
          </div>
        </div>

        <div className="modules-list">
          {course.modules.map((module) => (
            <div key={module.id} className="module-item">
              <div className="module-header">
                <h3>Módulo: {module.title}</h3>
                {/* Botão de Excluir Módulo */}
                <button
                  onClick={() => handleDeleteClick("module", module.id)}
                  className="delete-button"
                >
                  Excluir Módulo
                </button>
              </div>
              <ul className="lesson-list">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="lesson-item">
                    <span>{lesson.title}</span>
                    {/* Botões de Editar e Excluir Aula */}
                    <div className="lesson-actions">
                      <button onClick={() => setLessonToEdit(lesson)}>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClick("lesson", lesson.id)}
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
                <button onClick={() => handleAddLesson(module.id)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />

      {/* Renderização dos novos modais */}
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
            ? "Todas as aulas dentro dele também serão perdidas."
            : ""
        }`}
      />
    </div>
  );
};

export default AdminCourseEditor;
