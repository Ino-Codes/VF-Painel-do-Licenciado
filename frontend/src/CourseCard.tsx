// frontend/src/CourseCard.tsx
import React from "react";
import { Link } from "react-router-dom";

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
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const isCompleted =
    course.total_lessons > 0 &&
    course.completed_lessons >= course.total_lessons;

  return (
    <Link to={`/courses/${course.id}`} className="course-card-link">
      <div className="course-card">
        <div className="course-card-thumbnail">
          <img
            src={
              course.thumbnail_url ||
              "https://via.placeholder.com/400x225.png?text=Trilha"
            }
            alt={course.title}
          />
          {isCompleted && <div className="completion-badge">✓</div>}
        </div>
        <div className="course-card-content">
          <h3>{course.title}</h3>
          <p>{course.description}</p>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
