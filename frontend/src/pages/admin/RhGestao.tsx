import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
// Importe ícones apropriados (usando react-icons para consistência)
import {
  FaGraduationCap,
  FaChartLine,
  FaCalendarDay,
  FaUserPlus,
} from "react-icons/fa";
import { PiIslandFill } from "react-icons/pi";
import { MdFeedback } from "react-icons/md";

const RhGestao: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="tela-loading">Carregando...</div>;

  // Proteção de rota simples
  if (!user || (user.role !== "admin" && user.role !== "rh")) {
    navigate("/dashboard");
    return null;
  }

  const modules = [
    {
      title: "Cursos",
      description:
        "Crie, edite ou exclua cursos para os demais usuários do Painel",
      icon: <FaGraduationCap />,
      path: "/admin/courses",
    },
    {
      title: "Dashboards",
      description: "Visualize gráficos sobre o uso dos usuários no Painel",
      icon: <FaChartLine />,
      path: "/admin/dashboards",
    },
    {
      title: "Eventos",
      description: "Crie, edite ou exclua eventos para colaboradores internos",
      icon: <FaCalendarDay />,
      path: "/admin/calendar",
    },
    // {
    //   title: "Férias",
    //   description:
    //     "Gerencie solicitações e aprovações de férias dos colaboradores",
    //   icon: <PiIslandFill />,
    //   path: "/admin/ferias",
    // },
    // {
    //   title: "Feedbacks",
    //   description:
    //     "Convide colaboradores a enviar feedbacks sobre colegas e lideranças e gerencie feedbacks recebidos",
    //   icon: <MdFeedback />,
    //   path: "/admin/feedbacks",
    // },
    {
      title: "Recrutamento",
      description:
        "Gerencie processos seletivos e candidatos para vagas abertas",
      icon: <FaUserPlus />,
      path: "/admin/recrutamento",
    },
  ];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Gestão de RH</h2>
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

export default RhGestao;
