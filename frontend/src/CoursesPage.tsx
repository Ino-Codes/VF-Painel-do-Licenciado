import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate, Link } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner.tsx";
import EmptyState from "./EmptyState.tsx";
import EmptyCursosImage from "./assets/images/empty_cursos.svg";
import EmptyCertificadoImage from "./assets/images/empty_certificado.svg";

// Interface para os dados do curso
interface CourseData {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  total_lessons: number;
  completed_lessons: number;
}

// Interface para os dados do certificado
interface CertificateData {
  certificate_id: number;
  course_id: number;
  issue_date: string;
  course_title: string;
}

const CoursesPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseData[]>([]);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [activeTab, setActiveTab] = useState<"trilhas" | "certificados">(
    "trilhas"
  );
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      const res = await api.get("/api/admin/courses/public", {
        headers: { "x-user-id": user.id },
      });
      setCourses(res.data);
    } catch (err) {
      toast.error("Erro ao buscar cursos:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user]);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      const res = await api.get(`/api/certificates/user/${user.id}`);
      setCertificates(res.data);
    } catch (err) {
      toast.error("Erro ao buscar certificados:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      if (activeTab === "trilhas") {
        fetchCourses();
      } else {
        fetchCertificates();
      }
    }
  }, [user, activeTab, fetchCourses, fetchCertificates]);

  if (loading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return null; // ou um redirecionamento
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Cursos</h2>
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "trilhas" ? "active" : ""}`}
            onClick={() => setActiveTab("trilhas")}
          >
            Trilhas de Conhecimento
          </button>
          <button
            className={`tab-item ${
              activeTab === "certificados" ? "active" : ""
            }`}
            onClick={() => setActiveTab("certificados")}
          >
            Meus Certificados
          </button>
        </div>

        {isLoadingContent ? (
          <LoadingSpinner />
        ) : (
          <>
            {activeTab === "trilhas" && (
              <div className="courses-grid">
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <Link
                      to={`/courses/${course.id}`}
                      key={course.id}
                      className="course-card-link"
                    >
                      <div className="course-card">
                        <div className="course-card-thumbnail">
                          <img
                            src={
                              course.thumbnail_url ||
                              "https://via.placeholder.com/400x240.png?text=Curso"
                            }
                            alt={course.title}
                          />
                          {course.completed_lessons >= course.total_lessons &&
                            course.total_lessons > 0 && (
                              <div className="completion-badge">✓</div>
                            )}
                        </div>
                        <div className="course-card-content">
                          <h3>{course.title}</h3>
                          <p>{course.description}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="empty-state">
                    <EmptyState
                      image={EmptyCursosImage}
                      title="Nenhum curso disponível no momento. Retorne em breve."
                    ></EmptyState>
                  </div>
                )}
              </div>
            )}

            {activeTab === "certificados" && (
              <div className="certificates-grid">
                {certificates.length > 0 ? (
                  certificates.map((cert) => (
                    <div key={cert.certificate_id} className="certificate-card">
                      <h4>{cert.course_title}</h4>
                      <p>
                        Emitido em:{" "}
                        {new Date(cert.issue_date).toLocaleDateString("pt-BR")}
                      </p>
                      <Link
                        to={`/courses/${cert.course_id}/certificate`} // Link direto para a geração do certificado
                        target="_blank"
                        rel="noopener noreferrer"
                        className="form-button"
                        style={{ textDecoration: "none", marginTop: "15px" }}
                      >
                        Visualizar Certificado
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <EmptyState
                      image={EmptyCertificadoImage}
                      title="Os seus certificados serão exibidos aqui."
                    ></EmptyState>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
