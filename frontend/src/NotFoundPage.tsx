import React from "react";
import { Link } from "react-router-dom";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import EmptyState from "./EmptyState.tsx";
// Use a imagem que você baixou no passo anterior
import NotFoundImage from "./assets/images/404.svg";
import { useAuth } from "./context/AuthContext.tsx";

const NotFoundPage: React.FC = () => {
  const { user } = useAuth();

  return (
    // Usamos a classe 'p-2' para manter o mesmo fundo branco e layout
    <div className="p-2">
      {/* Mostramos o menu se o utilizador estiver logado, para facilitar a navegação */}
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
