import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import UserCard from "./UserCard.tsx";
import { useNavigate } from "react-router-dom";

const Empresa: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [internalUsers, setInternalUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    } else if (user) {
      api
        .get("/api/users/internal")
        .then((res) => setInternalUsers(res.data))
        .catch((err) => console.error("Erro ao buscar equipe", err));
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Nossa Equipe</h2>
          <p>Conheça os colaboradores que fazem parte da Valor Fiscal.</p>
        </div>
        <div className="user-grid">
          {internalUsers.map((internalUser) => (
            <UserCard key={internalUser.id} user={internalUser} />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Empresa;
