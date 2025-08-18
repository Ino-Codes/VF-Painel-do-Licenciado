import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";

// Interfaces para tipagem dos dados
interface Lesson {
  id: number;
  title: string;
}

interface Module {
  id: number;
  title: string;
  lessons: Lesson[];
}

interface Course {
  id: number;
  title: string;
  modules: Module[];
}

const AdminCourseEditor: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitles, setNewLessonTitles] = useState<{
    [key: number]: string;
  }>({});

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
    fetchCourseDetails();
  }, [fetchCourseDetails]);

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
      fetchCourseDetails(); // Recarrega os dados
    } catch (err) {
      toast.error("Erro ao adicionar módulo.");
    }
  };

  const handleAddLesson = async (moduleId: number) => {
    const lessonTitle = newLessonTitles[moduleId];
    const module = course?.modules.find((m) => m.id === moduleId);
    if (!lessonTitle.trim() || !module) return;
    try {
      const newOrder = module.lessons.length + 1;
      await api.post(
        `/api/admin/courses/modules/${moduleId}/lessons`,
        {
          title: lessonTitle,
          content_type: "video", // Placeholder, podemos evoluir depois
          content_data: "", // Placeholder
          lesson_order: newOrder,
        },
        getAuthHeaders()
      );
      toast.success("Aula adicionada!");
      setNewLessonTitles({ ...newLessonTitles, [moduleId]: "" });
      fetchCourseDetails(); // Recarrega os dados
    } catch (err) {
      toast.error("Erro ao adicionar aula.");
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

        {/* Listagem de Módulos e Aulas */}
        <div className="modules-list">
          {course.modules.map((module) => (
            <div key={module.id} className="module-item">
              <h3>Módulo: {module.title}</h3>
              <ul className="lesson-list">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id}>{lesson.title}</li>
                ))}
              </ul>
              {/* Formulário para adicionar nova aula */}
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

        {/* Formulário para adicionar novo módulo */}
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
      </div>
      <Footer />
    </div>
  );
};

export default AdminCourseEditor;
