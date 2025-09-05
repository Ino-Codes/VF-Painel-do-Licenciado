import React, { useState, useEffect } from "react";
import api from "./api.ts";
import { Bar } from "react-chartjs-2";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
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

const enneagramTypes = {
  1: {
    name: "O Perfeccionista",
    description:
      "Pessoas do tipo 1 são éticas e conscienciosas, com um forte senso de certo e errado.",
  },
  2: {
    name: "O Prestativo",
    description: "Pessoas do tipo 2 são empáticas, sinceras e calorosas.",
  },
  3: {
    name: "O Bem-Sucedido",
    description:
      "Pessoas do tipo 3 são autoconfiantes, charmosas e ambiciosas.",
  },
  4: {
    name: "O Individualista",
    description:
      "Pessoas do tipo 4 são autoconscientes, sensíveis e reservadas.",
  },
  5: {
    name: "O Observador",
    description: "Pessoas do tipo 5 são alertas, perspicazes e curiosas.",
  },
  6: {
    name: "O Leal",
    description: "Pessoas do tipo 6 são comprometidas, seguras e confiáveis.",
  },
  7: {
    name: "O Entusiasta",
    description:
      "Pessoas do tipo 7 são extrovertidas, otimistas e espontâneas.",
  },
  8: {
    name: "O Desafiador",
    description: "Pessoas do tipo 8 são autoconfiantes, fortes e assertivas.",
  },
  9: {
    name: "O Pacificador",
    description: "Pessoas do tipo 9 são receptivas, tranquilas e solidárias.",
  },
};

const EnneagramResultsPage: React.FC = () => {
  const [results, setResults] = useState(null);

  useEffect(() => {
    api.get("/api/enneagram/results").then((res) => setResults(res.data));
  }, []);

  if (!results) return <LoadingSpinner />;

  const dominantTypeInfo = enneagramTypes[results.dominant_type];

  const chartData = {
    labels: Object.values(enneagramTypes).map(
      (t, index) => `Tipo ${index + 1}: ${t.name}`
    ),
    datasets: [
      {
        label: "Pontuação",
        data: [
          results.score_1,
          results.score_2,
          results.score_3,
          results.score_4,
          results.score_5,
          results.score_6,
          results.score_7,
          results.score_8,
          results.score_9,
        ],
        backgroundColor: "rgba(221, 177, 65, 0.6)",
        borderColor: "rgba(221, 177, 65, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    indexAxis: "y" as const,
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
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
        <div style={{ maxWidth: "800px", margin: "40px auto" }}>
          <h4>Distribuição completa dos seus traços:</h4>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>
      <Footer />
    </div>
  );
};
export default EnneagramResultsPage;
