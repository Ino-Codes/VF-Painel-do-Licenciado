// src/pages/public/NotFoundPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { getIconByKey } from "../../utils/assets.ts";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const Icon404 = getIconByKey("404");

  return (
    <div
      className="not-found-container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "var(--bg-primary)", // Fundo dinâmico
        color: "var(--text-primary)", // Texto dinâmico
      }}
    >
      {Icon404 && (
        <Icon404 size={180} style={{ color: "var(--v-tax)" }} />
      )}

      <h1 style={{ fontSize: "2.5rem", marginBottom: "10px" }}>
        Página não encontrada
      </h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: "30px" }}>
        O conteúdo que você procura não existe ou foi movido.
      </p>

      <button className="form-button" onClick={() => navigate("/home")}>
        Voltar para o Início
      </button>
    </div>
  );
};

export default NotFoundPage;
