import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { Bar, Radar } from "react-chartjs-2";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";

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
  ChartOptions,
  ChartData,
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
  const { theme } = useTheme();
  const [results, setResults] = useState(null);
  const [typesInfo, setTypesInfo] = useState([]);
  const [activeTab, setActiveTab] = useState("percentual");

  const [percentageChartData, setPercentageChartData] = useState<
    ChartData<"bar">
  >({ datasets: [] });
  const [radarChartData, setRadarChartData] = useState<ChartData<"radar">>({
    datasets: [],
  });
  const [scoreChartData, setScoreChartData] = useState<ChartData<"bar">>({
    datasets: [],
  });
  const [chartOptions, setChartOptions] = useState<ChartOptions>({});
  const [radarOptions, setRadarOptions] = useState<ChartOptions<"radar">>({});

  useEffect(() => {
    Promise.all([
      api.get("/api/enneagram/results"),
      api.get("/api/enneagram/types"),
    ]).then(([resultsRes, typesRes]) => {
      setResults(resultsRes.data);
      setTypesInfo(typesRes.data);
    });
  }, []);

  useEffect(() => {
    if (!results || typesInfo.length === 0) return;

    const getCssVar = (varName: string) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();

    const textColor = getCssVar("--text-secondary");
    const borderColor = getCssVar("--border-color");

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

    const barOptions: ChartOptions = {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: textColor }, grid: { color: "transparent" } },
        x: { ticks: { color: textColor }, grid: { color: "transparent" } },
      },
    };

    const radarOptionsConfig: ChartOptions<"radar"> = {
      plugins: { legend: { display: false } },
      scales: {
        r: {
          angleLines: { color: borderColor },
          grid: { color: borderColor },
          pointLabels: { color: textColor, font: { size: 12 } },
          ticks: {
            color: textColor,
            backdropColor: getCssVar("--bg-secondary"),
          },
        },
      },
    };

    setChartOptions(barOptions);
    setRadarOptions(radarOptionsConfig);

    setPercentageChartData({
      labels: chartLabels,
      datasets: [
        {
          label: "Percentual (%)",
          data: scores.map((s) =>
            totalScore > 0 ? ((s / totalScore) * 100).toFixed(1) : 0
          ),
          backgroundColor: getCssVar("--bg-graph-column"),
          borderColor: getCssVar("--border-graph-column"),
          borderWidth: 1,
        },
      ],
    });

    setRadarChartData({
      labels: chartLabels,
      datasets: [
        {
          label: "Pontuação",
          data: scores,
          backgroundColor: getCssVar("--bg-graph-radar"),
          borderColor: getCssVar("--border-graph-radar"),
          borderWidth: 1,
        },
      ],
    });

    setScoreChartData({
      labels: chartLabels,
      datasets: [
        {
          label: "Pontuação",
          data: scores,
          backgroundColor: getCssVar("--bg-graph-bar"),
          borderColor: getCssVar("--border-graph-bar"),
          borderWidth: 1,
        },
      ],
    });
  }, [theme, results, typesInfo]);

  if (!results || typesInfo.length === 0) return <LoadingSpinner />;

  const dominantTypeInfo = typesInfo.find(
    (t) => t.id === results.dominant_type
  );

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
            <Bar data={percentageChartData} options={chartOptions} />
          )}
          {activeTab === "radar" && (
            <Radar data={radarChartData} options={radarOptions} />
          )}
          {activeTab === "pontos" && (
            <Bar
              data={scoreChartData}
              options={{ ...chartOptions, indexAxis: "y" }}
            />
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};
export default EnneagramResultsPage;
