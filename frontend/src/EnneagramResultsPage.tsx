import React, { useState, useEffect } from "react";
import api from "./api.ts";
import { Bar, Radar } from "react-chartjs-2";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title
);

const EnneagramResultsPage: React.FC = () => {
  const [results, setResults] = useState(null);
  const [typesInfo, setTypesInfo] = useState([]);
  const [activeTab, setActiveTab] = useState("resumo");

  useEffect(() => {
    // Faz as duas chamadas à API em paralelo
    Promise.all([
      api.get("/api/enneagram/results"),
      api.get("/api/enneagram/types"),
    ]).then(([resultsRes, typesRes]) => {
      setResults(resultsRes.data);
      setTypesInfo(typesRes.data);
    });
  }, []);

  if (!results || typesInfo.length === 0) return <LoadingSpinner />;

  const dominantTypeInfo = typesInfo.find(
    (t) => t.id === results.dominant_type
  );
  const scores = [
    results.score_1,
    results.score_2,
    results.score_3,
    results.score_4,
    results.score_5,
    results.score_6,
    results.score_7,
    results.score_8,
    results.score_9,
  ];
  const totalScore = scores.reduce((sum, score) => sum + score, 0);

  const chartLabels = typesInfo.map((t) => `Tipo ${t.id}: ${t.name}`);

  // Dados para o Gráfico de Barras (Pontuação)
  const scoreData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Pontuação",
        data: scores,
        backgroundColor: "rgba(221, 177, 65, 0.6)",
        borderColor: "rgba(221, 177, 65, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Dados para o Gráfico de Radar
  const scoreRadarData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Pontuação",
        data: scores,
        backgroundColor: "rgba(4, 67, 161, 0.6)",
        borderColor: "rgba(4, 90, 161, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Dados para o Gráfico de Barras (Percentual)
  const percentageData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Percentual (%)",
        data: scores.map((s) =>
          totalScore > 0 ? ((s / totalScore) * 100).toFixed(1) : 0
        ),
        backgroundColor: "rgba(4, 161, 70, 0.6)",
        borderColor: "rgba(4, 161, 70, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    indexAxis: "y" as const,
    plugins: { legend: { display: false } },
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Seu Resultado do Eneagrama</h2>

        <div className="result-summary">
          <h3>
            Seu tipo dominante é:{" "}
            <strong>
              Tipo {results.dominant_type} - {dominantTypeInfo.name}
            </strong>
          </h3>
          <p>{dominantTypeInfo.description}</p>
        </div>

        <div className="detailed-texts">
          <div className="text-block">
            <h4>No Trabalho</h4>
            <p>{dominantTypeInfo.work_description}</p>
          </div>
          <div className="text-block">
            <h4>Na Vida Pessoal</h4>
            <p>{dominantTypeInfo.personal_description}</p>
          </div>
        </div>

        <div className="tabs" style={{ marginTop: "40px" }}>
          <button
            className={`tab-item ${activeTab === "percentual" ? "active" : ""}`}
            onClick={() => setActiveTab("percentual")}
          >
            Gráfico Percentual
          </button>
          <button
            className={`tab-item ${activeTab === "radar" ? "active" : ""}`}
            onClick={() => setActiveTab("radar")}
          >
            Gráfico Radar
          </button>
          <button
            className={`tab-item ${activeTab === "pontos" ? "active" : ""}`}
            onClick={() => setActiveTab("pontos")}
          >
            Gráfico de Pontos
          </button>
        </div>

        <div className="chart-container">
          {activeTab === "percentual" && (
            <Bar data={percentageData} options={chartOptions} />
          )}
          {activeTab === "radar" && <Radar data={scoreRadarData} />}
          {activeTab === "pontos" && (
            <Bar data={scoreData} options={chartOptions} />
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};
export default EnneagramResultsPage;
