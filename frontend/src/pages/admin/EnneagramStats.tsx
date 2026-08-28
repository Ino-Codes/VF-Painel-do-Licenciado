import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { Bar } from "react-chartjs-2";
import { ChartSkeleton } from "../../components/ui/Skeleton.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface EnneagramType {
  id: number;
  name: string;
  description: string;
  work_description: string;
  personal_description: string;
}

interface CompletedUser {
  nome: string;
  setor?: string;
  dominant_type: number;
}

const EnneagramStats: React.FC = () => {
  const { theme } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const [typesInfo, setTypesInfo] = useState<EnneagramType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [chartOptions, setChartOptions] = useState<ChartOptions<"bar">>({});
  const [chartData, setChartData] = useState<ChartData<"bar">>({
    datasets: [],
  });

  useEffect(() => {
    if (!stats || typesInfo.length === 0) {
      return;
    }

    const getCssVar = (varName: string) =>
      getComputedStyle(document.body).getPropertyValue(varName).trim();

    setChartOptions({
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          ticks: { color: getCssVar("--text-secondary") },
          grid: { color: "transparent" },
        },
        x: {
          ticks: { color: getCssVar("--text-secondary") },
          grid: { color: "transparent" },
        },
      },
    });

    const chartLabels = typesInfo.map((t) => `${t.name} (Tipo ${t.id})`);
    const typeData = Array(9).fill(0);
    stats.typeCounts.forEach((item: any) => {
      typeData[item.dominant_type - 1] = item.count;
    });

    setChartData({
      labels: chartLabels,
      datasets: [
        {
          label: "Nº de Colaboradores",
          data: typeData,
          backgroundColor: getCssVar("--bg-graph"),
          borderColor: getCssVar("--border-graph"),
          borderWidth: 1,
        },
      ],
    });
  }, [theme, stats, typesInfo]);

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/analytics/enneagram-stats"),
      api.get("/api/enneagram/types"),
    ])
      .then(([statsRes, typesRes]) => {
        setStats(statsRes.data);
        setTypesInfo(typesRes.data);
        setLoadError(false);
      })
      .catch((err) => {
        setLoadError(true);
        console.error("Erro ao carregar dados do Eneagrama", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <ChartSkeleton />;
  }

  if (loadError) {
    return (
      <p className="tela-loading">
        Não foi possível carregar os dados. Tente novamente mais tarde.
      </p>
    );
  }

  if (!stats || typesInfo.length === 0) {
    return <p>Não foi possível carregar os dados.</p>;
  }

  const typesMap = typesInfo.reduce(
    (acc, type) => {
      acc[type.id] = type;
      return acc;
    },
    {} as Record<number, EnneagramType>,
  );

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
          <Bar data={chartData} options={chartOptions} />
        </div>

        <h4>Participação dos Colaboradores</h4>
        <div className="stat-card">
          <div className="stat-value">
            {stats.collaboratorStats.completed} de{" "}
            {stats.collaboratorStats.total}
          </div>
          <div className="stat-label">Colaboradores que concluíram o teste</div>
          <div className="progress-bar-background">
            <div
              className="progress-bar-foreground"
              style={
                {
                  "--progress-width": `${participationPercentage}%`,
                } as React.CSSProperties
              }
            >
              {participationPercentage}%
            </div>
          </div>
        </div>
      </div>

      <div className="stats-side-column">
        <h4>Resultados Individuais</h4>
        <ul className="user-results-list">
          {stats.completedUsers.map((user: CompletedUser, index: number) => {
            const firstName = user.nome.split(" ")[0];
            return (
              <li key={index}>
                <span className="user-name">
                  {user.setor && (
                    <span className="user-setor">({user.setor})</span>
                  )}
                  {firstName}
                </span>
                <span className="user-type">
                  {typesMap[user.dominant_type]?.name ||
                    `Tipo ${user.dominant_type}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default EnneagramStats;
