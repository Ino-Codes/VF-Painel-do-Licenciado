import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";

import { FaBuilding, FaChartPie, FaFileAlt } from "react-icons/fa";

const InternalGestao: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="tela-loading">Carregando...</div>;

  // Proteção de rota simples
  if (!user || user.role === "licenciado") {
    navigate("/dashboard");
    return null;
  }

  const modules = [
    {
      title: "Atas de Reuniões",
      description: "Acesse e gerencie as atas de reuniões da empresa",
      icon: <FaFileAlt />,
      path: "/internal/meeting-records",
    },
    {
      title: "Quem Somos",
      description: "Conheça a história da V-CORP e nosso time de colaboradores",
      icon: <FaBuilding />,
      path: "/internal/empresa",
    },
  ];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Área Interna</h2>
          <p>Selecione um módulo abaixo para acessar.</p>
        </div>

        <div className="gestao-modules-grid">
          {modules.map((module, index) => (
            <div
              key={index}
              className="gestao-module-card"
              onClick={() => navigate(module.path)}
            >
              <div className="gestao-module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default InternalGestao;
