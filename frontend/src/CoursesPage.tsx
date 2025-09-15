import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "./LoadingSpinner.tsx";
import EmptyState from "./EmptyState.tsx";
import EmptyCursosImage from "./assets/images/empty_cursos.svg";
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

  const [allCourses, setAllCourses] = useState<CourseData[]>([]);

  const [activeTab, setActiveTab] = useState<"all" | "ongoing">("all");
  const [isLoadingContent, setIsLoadingContent] = useState(true);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setIsLoadingContent(true);
    try {
      const res = await api.get("/api/admin/courses/public");
      setAllCourses(res.data);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
    if (user) {
      fetchCourses();
    }
  }, [user, loading, navigate, fetchCourses]);

  if (loading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return null;
  }

  const ongoingCourses = allCourses.filter(
    (course) =>
      course.completed_lessons > 0 &&
      course.completed_lessons < course.total_lessons
  );

  const availableCourses = allCourses.filter(
    (course) => course.completed_lessons === 0
  );

  const completedCourses = allCourses.filter(
    (course) =>
      course.total_lessons > 0 &&
      course.completed_lessons >= course.total_lessons
  );

  const coursesToDisplay =
    activeTab === "all"
      ? [...availableCourses, ...completedCourses]
      : ongoingCourses;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Cursos</h2>
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            Trilhas de Conhecimento
          </button>
          <button
            className={`tab-item ${activeTab === "ongoing" ? "active" : ""}`}
            onClick={() => setActiveTab("ongoing")}
          >
            Cursos em Andamento
          </button>
        </div>

        {isLoadingContent ? (
          <LoadingSpinner />
        ) : (
          <div className="courses-grid">
            {coursesToDisplay.length > 0 ? (
              coursesToDisplay.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            ) : (
              <EmptyState
                image={EmptyCursosImage}
                title={
                  activeTab === "all"
                    ? "Nenhum Curso Disponível"
                    : "Nenhum Curso em Andamento"
                }
                message={
                  activeTab === "all"
                    ? "Ainda não há cursos disponíveis. Volte em breve!"
                    : "Você ainda não iniciou nenhum curso. Explore as Trilhas de Conhecimento para começar!"
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
