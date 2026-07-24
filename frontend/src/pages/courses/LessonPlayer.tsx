import React, { useState, useEffect, useCallback } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom"; // Importado useSearchParams
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import { Module, Lesson } from "../../types.ts";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { FaArrowLeftLong } from "react-icons/fa6";

interface CourseWithDetails {
  id: number;
  title: string;
  modules: Module[];
  completedLessons: number[];
  quiz_id: number | null;
  has_passed_quiz: boolean;
}

const getYoutubeEmbedUrl = (url: string): string => {
  if (!url) return "";

  let videoId = "";
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("youtube.com")) {
      videoId = urlObj.searchParams.get("v") || "";
    } else if (urlObj.hostname.includes("youtu.be")) {
      videoId = urlObj.pathname.slice(1);
    }
  } catch (e) {
    if (!url.includes("http")) {
      videoId = url;
    }
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  return url;
};

const LessonPlayer: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  // 1. Captura o slug da empresa da URL atual para manter a navegação consistente
  const [searchParams] = useSearchParams();
  const companySlug = searchParams.get("company") || "v-tax";

  const [course, setCourse] = useState<CourseWithDetails | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourse = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const res = await api.get(
        `/api/admin/courses/public/${courseId}`,
        getAuthHeaders(),
      );
      setCourse(res.data);
      if (res.data.modules?.[0]?.lessons?.[0]) {
        setActiveLesson(res.data.modules[0].lessons[0]);
      } else {
        setActiveLesson(null);
      }
    } catch (error) {
      toast.error("Não foi possível carregar este curso.");
      // Redireciona mantendo o contexto da empresa em caso de erro
      navigate(`/content/courses?company=${companySlug}`);
    }
  }, [courseId, user, getAuthHeaders, navigate, companySlug]);

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
        `/api/admin/courses/lessons/${activeLesson.id}/complete`,
        {},
        getAuthHeaders(),
      );
      toast.success("Aula concluída!");
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              completedLessons: [...prev.completedLessons, activeLesson.id],
            }
          : null,
      );
    } catch (error) {
      toast.error("Erro ao salvar progresso.");
    }
  };

  const handleUnmarkAsComplete = async () => {
    if (!activeLesson || !course) return;
    try {
      await api.delete(
        `/api/admin/courses/lessons/${activeLesson.id}/progress`,
        getAuthHeaders(),
      );
      toast.success("Progresso removido!");
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              completedLessons: prev.completedLessons.filter(
                (id) => id !== activeLesson.id,
              ),
            }
          : null,
      );
    } catch (error) {
      toast.error("Erro ao remover progresso.");
    }
  };

  const handleGenerateCertificate = async () => {
    if (!course) return;

    toast.loading("Estamos gerando o seu certificado...");

    try {
      const response = await api.get(
        `/api/admin/courses/${course.id}/certificate`,
        {
          ...getAuthHeaders(),
          responseType: "blob",
        },
      );

      toast.dismiss();

      const url = window.URL.createObjectURL(new Blob([response.data]));

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `certificado-${course.title}.pdf`);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.dismiss();
      toast.error("Não foi possível gerar o certificado. Tente novamente.");
      console.error("Erro ao gerar certificado:", err);
    }
  };

  if (loading || !course) {
    return <LoadingSpinner />;
  }

  const totalLessons =
    course.modules?.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0) ||
    0;
  const isCourseCompleted =
    totalLessons > 0 && course.completedLessons.length >= totalLessons;

  const isLessonCompleted = activeLesson
    ? course.completedLessons.includes(activeLesson.id)
    : false;

  const renderCompletionButton = () => {
    if (!isCourseCompleted) return null;

    if (course.quiz_id && !course.has_passed_quiz) {
      return (
        <Link
          to={`/content/courses/${courseId}/quiz?company=${companySlug}`}
          className="form-button"
        >
          Fazer Teste Final
        </Link>
      );
    }

    return (
      <button onClick={handleGenerateCertificate} className="form-button">
        Gerar Certificado
      </button>
    );
  };

  return (
    <div className="p-2">
      <Menu />
      {/* Classe para aplicar o tema da empresa (opcional, se usar variáveis CSS globais) */}
      <div className={`content-area company-${companySlug}`}>
        <div className="document-header">
          {/* 2. Botão Voltar agora aponta para a URL com o parâmetro da empresa */}
          <Link
            to={`/content/courses?company=${companySlug}`}
            className="btn-back-subtle"
          >
            <FaArrowLeftLong />
            Voltar
          </Link>

          <h2>{course.title}</h2>
        </div>

        {isCourseCompleted && (
          <div className="certificate-banner">
            <p>Parabéns, você concluiu este curso!</p>
            {renderCompletionButton()}
          </div>
        )}

        <div className="lesson-player-layout">
          <div className="lesson-content">
            {activeLesson ? (
              <>
                <h3>{activeLesson.title}</h3>
                {activeLesson.video_url && (
                  <div className="lesson-content-video">
                    <iframe
                      src={getYoutubeEmbedUrl(activeLesson.video_url)}
                      title={activeLesson.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                )}
                {activeLesson.text_content && (
                  <div
                    className="lesson-content-text"
                    style={
                      {
                        "--lesson-text-mt": activeLesson.video_url
                          ? "25px"
                          : "0",
                      } as React.CSSProperties
                    }
                    dangerouslySetInnerHTML={{
                      __html: activeLesson.text_content,
                    }}
                  />
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

          <button
            className="sidebar-toggle-button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? "Fechar Menu de Aulas" : "Ver Aulas do Curso"}
          </button>

          <aside className={`lesson-sidebar ${isSidebarOpen ? "open" : ""}`}>
            {course.modules?.map((module) => (
              <div key={module.id}>
                <h4 className="sidebar-module-title">{module.title}</h4>
                {module.lessons?.map((lesson) => {
                  const isCompleted = course.completedLessons.includes(
                    lesson.id,
                  );
                  const isActive = activeLesson?.id === lesson.id;
                  return (
                    <a
                      key={lesson.id}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveLesson(lesson);
                        setIsSidebarOpen(false);
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
