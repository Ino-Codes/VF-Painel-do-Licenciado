import React from "react";
import { useNavigate } from "react-router-dom";
import { onKeyActivate } from "../../utils/a11y.ts";
import CapaPadraoCurso from "../../img/curso-padrao.webp";

interface CourseData {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  total_lessons: number;
  completed_lessons: number;
}

interface CourseCardProps {
  course: CourseData;
  companySlug?: string;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, companySlug }) => {
  const navigate = useNavigate();

  const isCompleted =
    course.total_lessons > 0 &&
    course.completed_lessons >= course.total_lessons;

  const handleClick = () => {
    const url = `/content/courses/${course.id}${
      companySlug ? `?company=${companySlug}` : ""
    }`;
    navigate(url);
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={onKeyActivate(handleClick)}
      role="button"
      tabIndex={0}
      className="course-card-link"
    >
      <div className="course-card">
        <div className="course-card-thumbnail">
          <img
            src={course.thumbnail_url || CapaPadraoCurso}
            alt={course.title}
          />
          {isCompleted && <div className="completion-badge">✓</div>}
        </div>
        <div className="course-card-content">
          <span className="course-lesson-count">
            {course.total_lessons}{" "}
            {course.total_lessons === 1 ? "aula" : "aulas"}
          </span>
          <h3>{course.title}</h3>
          <p>{course.description}</p>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
