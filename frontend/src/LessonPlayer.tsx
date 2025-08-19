import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import { Course, Module, Lesson } from "./types"; // Importando do nosso arquivo central

const LessonPlayer: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  // Extendemos a interface Course para incluir o progresso
  interface CourseWithProgress extends Course {
    completedLessons: number[];
  }

  const [course, setCourse] = useState<CourseWithProgress | null>(null);
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
      // Define a primeira aula como ativa ao carregar
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
    if (
      !activeLesson ||
      !course ||
      course.completedLessons.includes(activeLesson.id)
    )
      return;
    try {
      await api.post(
        `/api/courses/lessons/${activeLesson.id}/complete`,
        {},
        getAuthHeaders()
      );
      toast.success("Aula concluída!");
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              completedLessons: [...prev.completedLessons, activeLesson.id],
            }
          : null
      );
    } catch (error) {
      toast.error("Erro ao salvar progresso.");
    }
  };

  const handleUnmarkAsComplete = async () => {
    if (!activeLesson || !course) return;
    try {
      await api.delete(
        `/api/courses/lessons/${activeLesson.id}/progress`,
        getAuthHeaders()
      );
      toast.success("Progresso removido!");
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              completedLessons: prev.completedLessons.filter(
                (id) => id !== activeLesson.id
              ),
            }
          : null
      );
    } catch (error) {
      toast.error("Erro ao remover progresso.");
    }
  };

  if (loading || !course) {
    return <div className="tela-loading">Carregando sala de aula...</div>;
  }

  const isLessonCompleted = activeLesson
    ? course.completedLessons.includes(activeLesson.id)
    : false;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <Link
            to="/courses"
            className="form-button-cancel mb-4"
            style={{ textDecoration: "none" }}
          >
            &larr; Voltar
          </Link>
          <h2>{course.title}</h2>
        </div>
        <div className="lesson-player-layout">
          <div className="lesson-content">
            {activeLesson ? (
              <>
                <h3>{activeLesson.title}</h3>
                {activeLesson.content_type === "video" &&
                  activeLesson.content_data && (
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
                {activeLesson.content_type === "text" && (
                  <div
                    className="lesson-content-text"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {activeLesson.content_data}
                  </div>
                )}

                {isLessonCompleted ? (
                  <button
                    onClick={handleUnmarkAsComplete}
                    className="form-button-cancel mt-4"
                  >
                    Marcar como Não Concluída
                  </button>
                ) : (
                  <button
                    onClick={handleMarkAsComplete}
                    className="form-button mt-4"
                  >
                    Marcar como Concluída
                  </button>
                )}
              </>
            ) : (
              <p>Selecione uma aula na barra lateral para começar.</p>
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
                      {isCompleted ? "✓ " : "○ "}
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
