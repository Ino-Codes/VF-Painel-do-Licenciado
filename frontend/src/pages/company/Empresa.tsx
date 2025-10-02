import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import UserCard from "./UserCard.tsx";
import { useNavigate } from "react-router-dom";
import MapaEscritorios from "./MapaEscritorios.tsx";

// Ícones SVG
const IconeMissao = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);
const IconeVisao = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);
const IconeValores = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const Empresa: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<
    "rs" | "sc" | "sp" | "todos"
  >("todos");

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

  // 3. Lógica para filtrar os utilizadores
  const unitMap = {
    rs: "Matriz",
    sc: "Filial SC",
    sp: "Filial SP",
  };

  const filteredUsers = internalUsers.filter((user) => {
    if (selectedState === "todos") return true;
    return user.unidade === unitMap[selectedState];
  });

  const stateNames = {
    rs: "Rio Grande do Sul (Matriz)",
    sc: "Santa Catarina",
    sp: "São Paulo",
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <section className="info-section">
          <div className="page-header">
            <h2>Quem Somos</h2>
          </div>
          <div className="identidade-container">
            <div className="identidade-item">
              <IconeMissao />
              <h3>Missão</h3>
              <p>
                Substitua este texto pela missão da sua empresa. Descreva o
                propósito e o objetivo principal.
              </p>
            </div>
            <div className="identidade-item">
              <IconeVisao />
              <h3>Visão</h3>
              <p>
                Substitua este texto pela visão da sua empresa. Descreva onde a
                empresa aspira chegar no futuro.
              </p>
            </div>
            <div className="identidade-item">
              <IconeValores />
              <h3>Valores</h3>
              <p>
                Substitua este texto pelos valores da sua empresa. Liste os
                princípios que guiam a cultura e as ações.
              </p>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="page-header">
            <h2>Nossa História</h2>
          </div>
          <div className="timeline-container">
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Fundação</h4>
                <div className="timeline-image-placeholder"></div>
                <p>
                  Descreva o início da Valor Fiscal, a sua fundação, os
                  fundadores e o contexto da época.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Momento</h4>
                <div className="timeline-image-placeholder"></div>
                <p>
                  Descreva um marco importante na história da empresa, uma
                  conquista ou expansão significativa.
                </p>
              </div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Hoje</h4>
                <div className="timeline-image-placeholder"></div>
                <p>
                  Descreva o estado atual da empresa, as suas principais áreas
                  de atuação e a sua posição no mercado.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="page-header">
            <h2>Nossa Equipe</h2>
            <p>
              Com sede em Porto Alegre/RS e filiais em Balneário Camboriú/SC e
              São Paulo/SP, a Valor Fiscal atua em todo o país. Selecione um
              estado no mapa para ver a equipe local ou veja todos os
              colaboradores.
            </p>
          </div>

          <MapaEscritorios
            activeState={selectedState}
            onStateClick={setSelectedState}
          />
          <div className="map-controls">
            <button
              className={`map-button ${
                selectedState === "todos" ? "active" : ""
              }`}
              onClick={() => setSelectedState("todos")}
            >
              Ver Todos
            </button>
          </div>

          {selectedState !== "todos" && (
            <h3 className="equipe-local-title">
              Equipe Local: {stateNames[selectedState]}
            </h3>
          )}

          <div className="user-grid">
            {filteredUsers.map((internalUser) => (
              <UserCard key={internalUser.id} user={internalUser} />
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Empresa;
