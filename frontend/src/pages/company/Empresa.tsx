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
    <path d="m218 5.19c56.93 0.02 120.6 0.33 141.5 0.68 32.16 0.54 38.46 0.89 41 2.25 1.65 0.89 25.43 27.66 52.84 59.49 27.42 31.84 50.75 59.69 51.85 61.89 1.52 3.05 1.82 4.95 1.28 8-0.39 2.2-1.54 5.57-2.56 7.5-1.02 1.93-54.65 83.15-119.19 180.5-109.85 165.71-117.62 177.15-121.78 179.39-3.64 1.96-5.3 2.28-9.19 1.75-3.2-0.43-5.7-1.54-7.67-3.39-1.61-1.51-56.11-83.07-121.12-181.25-83.48-126.06-118.36-179.53-118.73-182-0.29-1.92 0.03-5.52 0.7-8 1.02-3.74 9.73-14.57 51.4-63.94 27.59-32.7 51.52-60.23 53.17-61.18 2.8-1.62 10.07-1.73 106.5-1.69zm-126.43 73.31c-19.56 22.83-35.23 41.74-34.82 42.03 0.41 0.29 18.98 0.53 41.25 0.54 31.94 0.02 40.73-0.25 41.58-1.28 0.59-0.71 7.89-19.06 16.23-40.79 8.34-21.72 15.17-40.06 15.18-40.75 0.01-0.96-5.03-1.25-21.92-1.25h-21.92zm113.53-39.26c-0.48 1.24-7.63 19.95-15.89 41.57-8.26 21.62-15.06 39.51-15.12 39.75-0.05 0.24 37.03 0.44 82.4 0.44 78.1 0 82.48-0.09 82.01-1.75-0.27-0.96-7.42-19.75-15.88-41.75l-15.39-40-101.26-0.52zm151.98 39.01c8.3 21.59 15.5 40.04 16 41 0.85 1.62 3.86 1.75 41.42 1.75 22.27 0 40.67-0.34 40.88-0.75 0.21-0.41-15.32-19.31-34.5-42l-34.88-41.25c-36 0-44 0.36-44 1 0 0.55 6.79 18.66 15.08 40.25zm-226.76 193.75c42.1 63.53 77.02 115.61 77.61 115.75 0.74 0.17 0.77-0.6 0.1-2.5-0.53-1.51-16.08-53.6-34.55-115.75-18.46-62.15-33.78-113.79-34.03-114.75-0.42-1.63-3.37-1.75-44.01-1.75-41.18 0-43.5 0.1-42.6 1.75 0.52 0.96 35.39 53.73 77.48 117.25zm83.77 22.27c22.77 76.32 41.63 138.77 41.91 138.77 0.27 0 19.13-62.45 41.91-138.77 22.77-76.32 41.56-139.33 41.75-140.02 0.27-0.99-16.98-1.25-83.82-1.25-66.92 0-84.05 0.26-83.66 1.25 0.27 0.69 19.13 63.7 41.91 140.02zm124.42-24.77c-18.47 62.15-34.01 114.24-34.54 115.75-0.67 1.9-0.64 2.67 0.1 2.5 0.58-0.14 35.5-52.22 77.6-115.75 42.09-63.52 76.94-116.29 77.43-117.25 0.85-1.65-1.5-1.75-42.55-1.75-40.51 0-43.48 0.12-43.95 1.75-0.28 0.96-15.62 52.6-34.09 114.75z" />
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
    rs: "Matriz em RS",
    sc: "Filial em SC",
    sp: "Filial em SP",
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
              Com atuação nacional, a matriz da Valor Fiscal está localizada em
              Porto Alegre/RS, e conta com filiais em Balneário Camboriú/SC e
              São Paulo/SP.
            </p>
            <p>
              Selecione um estado no mapa para ver a equipe local ou veja todos
              os colaboradores.
            </p>
          </div>

          <div className="equipe-layout">
            <div className="equipe-sidebar">
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
            </div>

            <div className="equipe-main-content">
              {selectedState !== "todos" && (
                <h3 className="equipe-local-title">
                  Colaboradores da {stateNames[selectedState]}
                </h3>
              )}

              {selectedState === "todos" && (
                <h3 className="equipe-local-title">
                  Todos os colaboradores da Valor Fiscal
                </h3>
              )}

              <div className="user-grid">
                {filteredUsers.map((internalUser) => (
                  <UserCard key={internalUser.id} user={internalUser} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Empresa;
