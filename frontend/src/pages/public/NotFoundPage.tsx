import React from "react";
import { Link } from "react-router-dom";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import { useAuth } from "../../context/AuthContext.tsx";

const NotFoundPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="p-2">
      {user && <Menu />}
      <div className="content-area">
        <EmptyState
          imageKey="404"
          title="Página Não Encontrada"
          message="O endereço que você tentou acessar não existe ou foi movido."
        ></EmptyState>
      </div>
      {user && <Footer />}
    </div>
  );
};

export default NotFoundPage;
