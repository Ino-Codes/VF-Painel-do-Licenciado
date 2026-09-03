import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import UserCard from "./UserCard.tsx";
import { useNavigate } from "react-router-dom";
import UserDetailModal from "./UserDetailModal.tsx";
import PraiseCard, { Praise } from "../../components/praises/PraiseCard.tsx";

import { FiTarget, FiEye } from "react-icons/fi";
import { RiVipDiamondLine } from "react-icons/ri";

const Empresa: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [setorPraises, setSetorPraises] = useState<Praise[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    } else if (user) {
      api
        .get("/api/users/internal")
        .then((res) => setInternalUsers(res.data))
        .catch((err) => console.error("Erro ao buscar equipe", err));
      api
        .get("/api/praises/setores")
        .then((res) => setSetorPraises(res.data))
        .catch((err) => console.error("Erro ao buscar elogios de setores", err));
    }
  }, [user, loading, navigate]);

  // Agrupa os elogios de setor por nome do setor (mantém a ordem do backend).
  const praisesBySetor = setorPraises.reduce<Record<string, Praise[]>>(
    (acc, p) => {
      const key = p.recipient_setor || "Setor";
      (acc[key] = acc[key] || []).push(p);
      return acc;
    },
    {},
  );

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
            <h2 >Nossos Valores</h2>
            <p className="page-description">
              Na V-Corp, acreditamos que grandes resultados nascem de pessoas comprometidas, relações de confiança e decisões guiadas por propósito. Atuamos com ética, transparência, responsabilidade e respeito, valorizando a colaboração, a inovação e o desenvolvimento contínuo. Temos senso de dono, buscamos soluções com proatividade e excelência e acreditamos que a forma como alcançamos nossos resultados é tão importante quanto os próprios resultados. Somos uma empresa em constante evolução, movida por pessoas, propósito e transformação.
            </p>
          </div>
            
        </section>

        <section className="info-section">
          <div className="page-header">
            <h2 >Nossa Equipe</h2>
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

        {setorPraises.length > 0 && (
          <section className="info-section">
            <div className="page-header">
              <h2 >Elogios aos Setores</h2>
              <p className="page-description">
                Confira os elogios recebidos pelos nossos setores
              </p>
            </div>
            {Object.entries(praisesBySetor).map(([setorNome, list]) => (
              <div key={setorNome} className="setor-praise-group">
                <h3 className="setor-praise-group-title">{setorNome}</h3>
                <div className="praise-grid praise-grid--testimonial">
                  {list.map((p) => (
                    <PraiseCard
                      key={p.id}
                      praise={p}
                      showRecipient={false}
                      variant="testimonial"
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
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
