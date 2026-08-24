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
import { MdFeedback } from "react-icons/md";

const RhGestao: React.FC = () => {
  const { loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="tela-loading">Carregando...</div>;

  // Cada card só aparece para quem tem o `.view` da tela correspondente.
  const modules = [
    {
      title: "Cursos",
      description:
        "Crie, edite ou exclua cursos para os demais usuários do Painel",
      icon: <FaGraduationCap />,
      path: "/admin/courses",
      permission: "courses.manage",
    },
    {
      title: "Dashboards",
      description: "Visualize gráficos sobre o uso dos usuários no Painel",
      icon: <FaChartLine />,
      path: "/admin/dashboards",
      permission: "analytics.view",
    },
    {
      title: "Eventos",
      description: "Crie, edite ou exclua eventos para colaboradores internos",
      icon: <FaCalendarDay />,
      path: "/admin/calendar",
      permission: "events.manage",
    },
    {
      title: "Feedbacks",
      description:
        "Convide colaboradores a enviar feedbacks e gerencie os recebidos",
      icon: <MdFeedback />,
      path: "/admin/feedbacks",
      permission: "feedbacks.view",
    },
    {
      title: "Recrutamento",
      description:
        "Gerencie processos seletivos e candidatos para vagas abertas",
      icon: <FaUserPlus />,
      path: "/admin/recrutamento",
      permission: "recruitment.view",
    },
  ].filter((m) => hasPermission(m.permission));

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
