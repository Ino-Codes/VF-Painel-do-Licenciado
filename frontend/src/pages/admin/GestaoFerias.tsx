import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";

const GestaoFerias: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // No futuro, aqui teremos os estados para os pedidos, calendário, etc.

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
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
          <h2>Gestão de Férias</h2>
          <p>
            Aprove, recuse e visualize os pedidos de férias dos colaboradores.
          </p>
        </div>

        {/* O conteúdo principal do módulo virá aqui */}
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          Módulo de Gestão de Férias em desenvolvimento.
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GestaoFerias;
