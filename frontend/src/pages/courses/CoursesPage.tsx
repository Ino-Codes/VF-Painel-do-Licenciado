import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import CourseCard from "../../components/ui/CourseCard.tsx";
import { CoursesGridSkeleton } from "../../components/ui/Skeleton.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";

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

  const [company, setCompany] = useState<string>("all");

  const [allCourses, setAllCourses] = useState<CourseData[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "ongoing">("all");
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      // 2. Envio do parâmetro company para a API
      const res = await api.get("/api/admin/courses/public", {
        params: {
          company,
          _t: new Date().getTime(), // Evita cache
        },
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      setAllCourses(res.data);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user, company]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
    if (user) {
      fetchCourses();
    }
  }, [user, loading, navigate, fetchCourses]);

  if (!user) {
    return null;
  }

  const ongoingCourses = allCourses.filter(
    (course) =>
      course.completed_lessons > 0 &&
      course.completed_lessons < course.total_lessons,
  );

  const availableCourses = allCourses.filter(
    (course) => course.completed_lessons === 0,
  );

  const completedCourses = allCourses.filter(
    (course) =>
      course.total_lessons > 0 &&
      course.completed_lessons >= course.total_lessons,
  );

  const coursesToDisplay =
    activeTab === "all"
      ? [...availableCourses, ...completedCourses]
      : ongoingCourses;

  return (
    <div className="p-2">
      <Menu />
      <div className={`content-area document-center company-${company}`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">Cursos</h2>
          </div>
        </div>

        <CompanyFilter value={company} onChange={setCompany} />

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            Catálogo de Cursos
          </button>
          <button
            className={`tab-item ${activeTab === "ongoing" ? "active" : ""}`}
            onClick={() => setActiveTab("ongoing")}
          >
            Cursos em Andamento
          </button>
        </div>

        {isLoadingContent ? (
          <CoursesGridSkeleton />
        ) : (
          <div>
            {coursesToDisplay.length > 0 ? (
              <div className="courses-grid">
                {coursesToDisplay.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    companySlug={company === "all" ? undefined : company}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                imageKey="cursos"
                title={
                  activeTab === "all"
                    ? "Nenhum Curso Disponível"
                    : "Nenhum Curso em Andamento"
                }
                message={
                  activeTab === "all"
                    ? "Estamos preparando conteúdos incríveis! Fique de olho, as novidades chegam em breve."
                    : "Pronto para começar? Seus cursos em andamento serão exibidos aqui para facilitar seu acesso."
                }
              />
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
