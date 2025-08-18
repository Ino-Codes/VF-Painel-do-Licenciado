import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";

// Interfaces
interface Lesson {
  id: number;
  title: string;
  content_type: string;
  content_data: string;
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
  completedLessons: number[];
}

const LessonPlayer: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourse = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const res = await api.get(
        `/api/admin/courses/public/${courseId}`,
        getAuthHeaders()
      );
      setCourse(res.data);
      // Define a primeira aula como ativa, se houver
      if (res.data.modules?.[0]?.lessons?.[0]) {
        setActiveLesson(res.data.modules[0].lessons[0]);
      }
    } catch (error) {
      toast.error("Não foi possível carregar esta trilha.");
      navigate("/courses");
    }
  }, [courseId, user, getAuthHeaders, navigate]);

  useEffect(() => {
    if (user) fetchCourse();
  }, [user, fetchCourse]);

  const handleMarkAsComplete = async () => {
    if (!activeLesson || !course) return;
    try {
      await api.post(
        `/api/admin/courses/lessons/${activeLesson.id}/complete`,
        {},
        getAuthHeaders()
      );
      toast.success("Aula concluída!");
      // Atualiza o estado local para refletir a conclusão
      if (!course.completedLessons.includes(activeLesson.id)) {
        setCourse({
          ...course,
          completedLessons: [...course.completedLessons, activeLesson.id],
        });
      }
    } catch (error) {
      toast.error("Erro ao salvar progresso.");
    }
  };

  const handleUnmarkAsComplete = async () => {
    if (!activeLesson || !course) return;
    try {
      await api.delete(
        `/api/admin/courses/lessons/${activeLesson.id}/progress`,
        getAuthHeaders()
      );
      toast.success("Progresso removido!");
      // Atualiza o estado local
      setCourse({
        ...course,
        completedLessons: course.completedLessons.filter(
          (id) => id !== activeLesson.id
        ),
      });
    } catch (error) {
      toast.error("Erro ao remover progresso.");
    }
  };

  if (loading || !course) {
    return <div className="tela-loading">Carregando sala de aula...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>{course.title}</h2>
        </div>
        <div className="lesson-player-layout">
          <div className="lesson-content">
            {activeLesson ? (
              <>
                <h3>{activeLesson.title}</h3>
                {activeLesson.content_type === "video" && (
                  <div className="lesson-content-video">
                    <iframe
                      src={activeLesson.content_data}
                      title={activeLesson.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}
                <button
                  onClick={handleMarkAsComplete}
                  className="form-button mt-4"
                >
                  Marcar como Concluída
                </button>
              </>
            ) : (
              <p>Selecione uma aula para começar.</p>
            )}
          </div>

          <aside className="lesson-sidebar">
            {course.modules.map((module) => (
              <div key={module.id}>
                <h4 className="sidebar-module-title">{module.title}</h4>
                {module.lessons.map((lesson) => {
                  const isCompleted = course.completedLessons.includes(
                    lesson.id
                  );
                  const isActive = activeLesson?.id === lesson.id;
                  return (
                    <a
                      key={lesson.id}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveLesson(lesson);
                      }}
                      className={`sidebar-lesson-item ${
                        isActive ? "active" : ""
                      } ${isCompleted ? "completed" : ""}`}
                    >
                      {isCompleted ? "✓ " : ""}
                      {lesson.title}
                    </a>
                  );
                })}
              </div>
            ))}
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LessonPlayer;
