import React, { useState, useEffect } from "react";
import api from "./api.ts";
import { Bar } from "react-chartjs-2";
import LoadingSpinner from "./LoadingSpinner.tsx";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const EnneagramStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/admin/analytics/enneagram-stats")
      .then((res) => {
        setStats(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar estatísticas", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="stats-loading">Carregando estatísticas...</div>;
  }

  if (!stats) {
    return <p>Não foi possível carregar os dados.</p>;
  }

  const typeLabels = Array.from({ length: 9 }, (_, i) => `Tipo ${i + 1}`);
  const typeData = Array(9).fill(0);
  stats.typeCounts.forEach((item: any) => {
    typeData[item.dominant_type - 1] = item.count;
  });

  const chartData = {
    labels: typeLabels,
    datasets: [
      {
        label: "Nº de Colaboradores",
        data: typeData,
        backgroundColor: "rgba(221, 177, 65, 0.6)",
        borderColor: "rgba(221, 177, 65, 1)",
        borderWidth: 1,
      },
    ],
  };

  const participationPercentage =
    stats.collaboratorStats.total > 0
      ? (
          (stats.collaboratorStats.completed / stats.collaboratorStats.total) *
          100
        ).toFixed(0)
      : 0;

  return (
    <div className="stats-container">
      <div className="stats-main-column">
        <h4>Distribuição de Perfis na Equipe</h4>
        <div className="chart-container-stats">
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
            }}
          />
        </div>

        <h4>Participação dos Colaboradores</h4>
        <div className="stat-card">
          <div className="stat-value">
            {stats.collaboratorStats.completed} /{" "}
            {stats.collaboratorStats.total}
          </div>
          <div className="stat-label">Colaboradores que concluíram o teste</div>
          <div className="progress-bar-background">
            <div
              className="progress-bar-foreground"
              style={{ width: `${participationPercentage}%` }}
            >
              {participationPercentage}%
            </div>
          </div>
        </div>
      </div>

      <div className="stats-side-column">
        <h4>Resultados Individuais</h4>
        <ul className="user-results-list">
          {stats.completedUsers.map((user: any, index: number) => (
            <li key={index}>
              <span className="user-name">{user.nome}</span>
              <span className="user-type">Tipo {user.dominant_type}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EnneagramStats;
