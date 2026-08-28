import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { FaUserTie } from "react-icons/fa";
import { RankingSkeleton } from "../../components/ui/Skeleton.tsx";

interface EngagementData {
  nome: string;
  avatar_url: string | null;
  completed_lessons_count: number;
}

const CourseEngagementDash: React.FC = () => {
  const [engagementData, setEngagementData] = useState<EngagementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchEngagement = async () => {
      try {
        const res = await api.get("/api/admin/analytics/course-engagement");
        setEngagementData(res.data);
        setLoadError(false);
      } catch (err) {
        setLoadError(true);
        toast.error("Não foi possível carregar o ranking de engajamento.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEngagement();
  }, []);

  if (isLoading) {
    return <RankingSkeleton />;
  }

  if (loadError) {
    return (
      <p className="tela-loading">
        Não foi possível carregar os dados. Tente novamente mais tarde.
      </p>
    );
  }

  if (engagementData.length === 0) {
    return <p>Ainda não há dados de engajamento para exibir.</p>;
  }

  return (
    <div className="engagement-dash-container">
      <h4>🏆 Top 3 - Aulas Concluídas</h4>
      <ul className="engagement-list">
        {engagementData.map((user, index) => (
          <li key={index} className="engagement-item">
            <span className="engagement-rank">#{index + 1}</span>
            <div className="engagement-user-avatar">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.nome}
                  className="profile-avatar-img-small"
                />
              ) : (
                <FaUserTie className="profile-avatar-icon-small" />
              )}
            </div>
            <span className="engagement-user-name">{user.nome}</span>
            <span className="engagement-score">
              {user.completed_lessons_count} aulas
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CourseEngagementDash;
