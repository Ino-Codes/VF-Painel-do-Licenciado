import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";

import { FaUserCog, FaUserSecret, FaLaptop } from "react-icons/fa";
import { FaMagnifyingGlassChart } from "react-icons/fa6";

const AdminGestao: React.FC = () => {
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
      title: "Estatísticas Ao Vivo",
      description: "Visualize as métricas de uso do Painel em tempo real",
      icon: <FaMagnifyingGlassChart />,
      path: "/admin/statistics",
    },
    // {
    //   title: "Help Desk",
    //   description: "Gerencie os tickets de suporte",
    //   icon: <FaLaptop />,
    //   path: "/admin/helpdesk",
    // },
    {
      title: "Logs de Atividade",
      description: "Visualize e gerencie os logs de atividade",
      icon: <FaUserSecret />,
      path: "/admin/logs",
    },
    {
      title: "Usuários",
      description: "Visualize e gerencie os usuários do Painel",
      icon: <FaUserCog />,
      path: "/admin/users",
    },
  ];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Gestão de Admin</h2>
          <p>Selecione um módulo abaixo para gerenciar.</p>
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

export default AdminGestao;
