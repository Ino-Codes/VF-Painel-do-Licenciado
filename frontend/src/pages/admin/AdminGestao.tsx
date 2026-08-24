import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";

import {
  FaUserCog,
  FaUserSecret,
  FaHeadset,
  FaUsers,
} from "react-icons/fa";
import { FaMagnifyingGlassChart } from "react-icons/fa6";

const AdminGestao: React.FC = () => {
  const { loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="tela-loading">Carregando...</div>;

  // Cada card só aparece para quem tem o `.view` da tela correspondente.
  const modules = [
    {
      title: "Central de Chamados",
      description: "Gerencie os tickets de suporte",
      icon: <FaHeadset />,
      path: "/admin/helpdesk",
      permission: "tickets.view",
    },
    {
      title: "Estatísticas Ao Vivo",
      description: "Visualize as métricas de uso do Painel em tempo real",
      icon: <FaMagnifyingGlassChart />,
      path: "/admin/statistics",
      permission: "analytics.view",
    },
    {
      title: "Logs de Atividade",
      description: "Visualize e gerencie os logs de atividade",
      icon: <FaUserSecret />,
      path: "/admin/logs",
      permission: "logs.view",
    },
    {
      title: "Usuários",
      description: "Visualize e gerencie os usuários do Painel",
      icon: <FaUserCog />,
      path: "/admin/users",
      permission: "users.view",
    },
    {
      title: "Grupos & Permissões",
      description: "Gerencie grupos de usuário e suas permissões",
      icon: <FaUsers />,
      path: "/admin/groups",
      permission: "groups.view",
    },
  ].filter((m) => hasPermission(m.permission));

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Gestão de Admin</h2>
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
