import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate, Link } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner.tsx";
import EmptyState from "./EmptyState.tsx";
import EmptyCursosImage from "./assets/images/empty_cursos.svg";
import toast from "react-hot-toast";
import CourseCard from "./CourseCard.tsx";

interface CourseData {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  total_lessons: number;
  completed_lessons: number;
}

const CoursesPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseData[]>([]);
  const [activeTab, setActiveTab] = useState<"cursos">("cursos");
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
        </div>

        {isLoadingContent ? (
          <LoadingSpinner />
        ) : (
          <>
            {activeTab === "cursos" && (
              <div>
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <div className="courses-grid">
                      <CourseCard key={course.id} course={course} />
                    </div>
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
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
