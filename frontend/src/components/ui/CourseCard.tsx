import React from "react";
import { useNavigate } from "react-router-dom";

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
    <div onClick={handleClick} className="course-card-link">
      <div className="course-card">
        <div className="course-card-thumbnail">
          <img
            src={
              course.thumbnail_url ||
              "https://res.cloudinary.com/dsgbgrll5/image/upload/v1756927817/ev4gvx4bqvz5x34ngrc8_x6fzrp.jpg"
            }
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
