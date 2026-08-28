import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import UserCard from "./UserCard.tsx";
import { useNavigate } from "react-router-dom";
import UserDetailModal from "./UserDetailModal.tsx";

import { FiTarget, FiEye } from "react-icons/fi";
import { RiVipDiamondLine } from "react-icons/ri";

const Empresa: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
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
              <FiTarget />
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
              <FiEye />
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
              <RiVipDiamondLine />
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

        <section className="info-section">
          <div className="page-header">
            <h2>Nossa Equipe</h2>
          </div>

          <div className="equipe-layout">
            <div className="equipe-main-content">
              <div className="user-grid">
                {internalUsers.map((internalUser) => (
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
