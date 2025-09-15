import React from "react";
import { Link } from "react-router-dom";
import api from ".../api.ts";
import Menu from ".../components/layout/Menu.tsx";
import Footer from ".../components/layout/Footer.tsx";
import EmptyState from ".../components/ui/EmptyState.tsx";
import NotFoundImage from ".../assets/images/404.svg";
import { useAuth } from ".../context/AuthContext.tsx";

const NotFoundPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="p-2">
      {user && <Menu />}
      <div className="content-area">
        <EmptyState
          image={NotFoundImage}
          title="Página Não Encontrada"
          message="O endereço que você tentou acessar não existe ou foi movido. Que tal voltar para um lugar seguro?"
        >
          <Link
            to="/dashboard"
            className="form-button"
            style={{ textDecoration: "none" }}
          >
            Ir para o Dashboard
          </Link>
        </EmptyState>
      </div>
      {user && <Footer />}
    </div>
  );
};

export default NotFoundPage;
