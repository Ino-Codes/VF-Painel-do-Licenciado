import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";

import { MdPlayLesson, MdPlayCircle } from "react-icons/md";
import { IoMdDocument } from "react-icons/io";
import { RiQuestionnaireFill } from "react-icons/ri";
import { IoShareSocialSharp } from "react-icons/io5";
import { HiSpeakerphone } from "react-icons/hi";
import { FaArchive } from "react-icons/fa";

const ContentGestao: React.FC = () => {
  const { loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="tela-loading">Carregando...</div>;

  const modules = [
    {
      title: "Arquivos",
      description: "Documentos arquivados e históricos de conteúdo",
      icon: <FaArchive />,
      path: "/content/arquivos",
    },
    {
      title: "Avisos",
      description: "Comunicados e anúncios oficiais",
      icon: <HiSpeakerphone />,
      path: "/content/avisos",
    },
    {
      title: "Cursos",
      description: "Trilhas de capacitação e treinamentos",
      icon: <MdPlayLesson />,
      path: "/content/courses",
    },
    {
      title: "Documentos",
      description: "Arquivos oficiais e materiais de apoio",
      icon: <IoMdDocument />,
      path: "/content/documentos",
    },
    {
      title: "Mídias Sociais",
      description: "Conteúdo oficial para redes sociais",
      icon: <IoShareSocialSharp />,
      path: "/content/midiassociais",
    },
    {
      title: "FAQ",
      description: "Perguntas frequentes e respostas",
      icon: <RiQuestionnaireFill />,
      path: "/content/faq",
    },
    {
      title: "Vídeos",
      description: "Vídeos institucionais e operacionais",
      icon: <MdPlayCircle />,
      path: "/content/videos",
    },
  ];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2 >Conteúdos</h2>
          
        </div>

        <div className="gestao-modules-grid">
          {modules.map((module, index) => (
            <div
              key={index}
              className="gestao-module-card"
              onClick={() => navigate(module.path)}
            >
              <div className="gestao-module-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContentGestao;
