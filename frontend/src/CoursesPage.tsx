import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import LoadingSpinner from "./LoadingSpinner.tsx";
import EmptyState from "./EmptyState.tsx";
import EmptyAvisosImage from "./assets/images/empty_cursos.svg";

interface Course {
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
  const [courses, setCourses] = useState<Course[]>([]);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      try {
        const res = await api.get(
          "/api/admin/courses/public",
          getAuthHeaders()
        );
        setCourses(res.data);
      } catch (err) {
        toast.error("Não foi possível carregar as trilhas.");
      }
    };
    if (user) {
      fetchCourses();
    }
  }, [user, getAuthHeaders]);

  if (loading) {
    return <LoadingSpinner />;
  }

  const handleCourseClick = (courseId: number) => {
    navigate(`/courses/${courseId}`);
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Trilhas de Conhecimento</h2>
        </div>
        <div className="courses-grid">
          {courses.length > 0 ? (
            courses.map((course) => {
              const isCourseCompleted =
                course.total_lessons > 0 &&
                course.completed_lessons >= course.total_lessons;

              return (
                <div
                  key={course.id}
                  className="course-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="course-card-thumbnail">
                    <img
                      src={
                        course.thumbnail_url ||
                        "https://via.placeholder.com/400x225.png?text=Trilha"
                      }
                      alt={course.title}
                    />
                    {isCourseCompleted && (
                      <div className="completion-badge">✓</div>
                    )}
                  </div>
                  <div className="course-card-content">
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              image={EmptyAvisosImage}
              title="Nenhum curso disponível no momento. Retorne em breve."
            ></EmptyState>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
