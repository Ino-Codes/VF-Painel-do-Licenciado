// src/pages/public/NotFoundPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { getIconByKey } from "../../utils/assets.ts";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const Icon404 = getIconByKey("404");

  return (
    <div className="not-found-container">
      {Icon404 && <Icon404 size={180} className="notfound-icon" />}

      <h1 className="notfound-title">Página não encontrada</h1>

      <p className="notfound-subtitle">
        O conteúdo que você procura não existe ou foi movido.
      </p>

      <button className="form-button" onClick={() => navigate("/home")}>
        Voltar para o Início
      </button>
    </div>
  );
};

export default NotFoundPage;
