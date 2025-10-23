import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import UserCard from "./UserCard.tsx";
import { useNavigate } from "react-router-dom";
import MapaEscritorios from "./MapaEscritorios.tsx";
import UserDetailModal from "./UserDetailModal.tsx";

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
    strokeWidth="2.0"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon
      class="st0"
      points=".67 9.04 12 21.36 23.33 9.04 19.39 2.64 4.61 2.64 .67 9.04"
    />
    <path class="st0" d="M.67,9.04h22.66H.67Z" />
    <polygon
      class="st0"
      points="8.89 2.64 7.07 8.79 12 20.61 16.93 8.79 15.09 2.64 8.89 2.64"
    />
  </svg>
);

const Empresa: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<
    "rs" | "sc" | "sp" | "todos"
  >("todos");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

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

  const handleOpenModal = (userToShow: any) => {
    setSelectedUser(userToShow);
  };
  const handleCloseModal = () => {
    setSelectedUser(null);
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
                Somos uma empresa de inteligência tributária que une
                conhecimentos administrativos e contábeis para construir
                soluções que fazem sentido para quem está na linha de frente dos
                negócios.
                <br />
                Buscamos incessantemente ser os melhores – nada menos que os
                melhores.
              </p>
            </div>
            <div className="identidade-item">
              <IconeVisao />
              <h3>Visão</h3>
              <p>
                Ser referência nacional em nosso segmento, por meio de um
                trabalho extremamente técnico, ético e de excelência. Cumprir o
                nosso propósito, alinhado ao projeto de expansão para todo o
                território brasileiro, buscando o equilíbrio entre a
                lucratividade e a consciência social
              </p>
            </div>
            <div className="identidade-item">
              <IconeValores />
              <h3>Valores</h3>
              <p>
                Somos uma empresa comprometida com a ética, integridade e
                honestidade. Trabalhamos de forma transparente e entregamos
                serviços de excelência com foco na geração de resultados que
                superem as expectativas de nossos clientes.
              </p>
            </div>
          </div>
        </section>

        {/* <section className="info-section">
          <div className="page-header">
            <h2>Nossa História</h2>
          </div>

          <div className="timeline-container">
            <div className="timeline-item">
              <div className="timeline-image-placeholder">
                <img
                  src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1759930448/default-01_br7je3.png"
                  alt="Fundação da Valor Fiscal"
                />
              </div>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>2014</h4>
                <p>Descrição de outro momento.</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-image-placeholder">
                <img
                  src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1759930448/default-01_br7je3.png"
                  alt="Outr marco importante"
                />
              </div>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>2021</h4>
                <p>Descrição de outro momento.</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-image-placeholder">
                <img
                  src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1759930448/default-01_br7je3.png"
                  alt="Outro marco importante"
                />
              </div>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>2022</h4>
                <p>Descrição de outro momento.</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-image-placeholder">
                <img
                  src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1759930448/default-01_br7je3.png"
                  alt="Estado atual da empresa"
                />
              </div>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>2025</h4>
                <p>Descrição de outro momento.</p>
              </div>
            </div>
          </div>
        </section> */}

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
                  <UserCard
                    key={internalUser.id}
                    user={internalUser}
                    onClick={() => handleOpenModal(internalUser)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
      <UserDetailModal
        isOpen={selectedUser !== null}
        onClose={handleCloseModal}
        user={selectedUser}
      />
    </div>
  );
};

export default Empresa;
