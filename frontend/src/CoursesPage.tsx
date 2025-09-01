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
import toast from "react-hot-toast";
import CourseCard from "./CourseCard.tsx";

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
  const [activeTab, setActiveTab] = useState<"cursos" | "certificados">(
    "cursos"
  );
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  const baseURL = api.defaults.baseURL;

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      const res = await api.get("/api/admin/courses/public", getAuthHeaders());
      setCourses(res.data);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user, getAuthHeaders]);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      const res = await api.get(`/api/certificates/user/${user.id}`);
      setCertificates(res.data);
    } catch (err) {
      console.error("Erro ao buscar certificados:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user]);

  const handleViewCertificate = async (
    courseId: number,
    courseTitle: string
  ) => {
    toast.loading("Preparando o seu certificado...");
    try {
      const response = await api.get(
        `/api/admin/courses/${courseId}/certificate`,
        {
          ...getAuthHeaders(),
          responseType: "blob",
        }
      );
      toast.dismiss();

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `certificado-${courseTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.dismiss();
      toast.error("Não foi possível gerar o certificado. Tente novamente.");
      console.error("Erro ao gerar certificado:", err);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      if (activeTab === "cursos") {
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
    return null;
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
            className={`tab-item ${activeTab === "cursos" ? "active" : ""}`}
            onClick={() => setActiveTab("cursos")}
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
            {activeTab === "cursos" && (
              <div className="courses-grid">
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))
                ) : (
                  <EmptyState
                    image={EmptyCursosImage}
                    title="Nenhum Curso Disponível"
                    message="Ainda não há cursos disponíveis. Volte em breve!"
                  />
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
                      <button
                        className="form-button"
                        id="form-button-certificate"
                        style={{ marginTop: "auto" }}
                        onClick={() =>
                          handleViewCertificate(
                            cert.course_id,
                            cert.course_title
                          )
                        }
                      >
                        Visualizar Certificado
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    image={EmptyCertificadoImage}
                    title="Nenhum Certificado Disponível"
                    message="Você ainda não concluiu nenhum curso para obter um certificado. Complete um curso e ele aparecerá aqui!"
                  />
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
