import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom"; // Importar useSearchParams
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { CompanySlug } from "../../types.ts";

import { MdPlayLesson, MdPlayCircle } from "react-icons/md";
import { IoMdDocument } from "react-icons/io";
import { RiQuestionnaireFill } from "react-icons/ri";
import { IoShareSocialSharp } from "react-icons/io5";
import { HiSpeakerphone } from "react-icons/hi";

// Configuração local para exibição (pode ser movida para utils/companies.ts depois)
const COMPANIES_INFO = {
  "v-tax": { name: "V-TAX", color: "var(--v-tax)" },
  "v-banking": { name: "V-BANKING", color: "var(--v-banking)" },
  "v-business": { name: "V-BUSINESS", color: "var(--v-business)" },
  "v-corp": { name: "V-CORP", color: "var(--v-corp)" },
  "v-tech": { name: "V-TECH", color: "var(--v-tech)" },
};

const ContentGestao: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Hook para ler a URL

  // Pega o slug da URL ou usa 'valor-fiscal' como fallback
  const companySlug =
    (searchParams.get("company") as CompanySlug) || "v-tax";
  const companyInfo =
    COMPANIES_INFO[companySlug] || COMPANIES_INFO["v-tax"];

  if (loading) return <div className="tela-loading">Carregando...</div>;

  // Definição dos módulos com os links atualizados para incluir o parâmetro
  const modules = [
    {
      title: "Avisos",
      description: "Comunicados e anúncios oficiais da empresa",
      icon: <HiSpeakerphone />,
      path: `/content/avisos?company=${companySlug}`,
    },
    {
      title: "Cursos",
      description: `Trilhas de capacitação e treinamentos`,
      icon: <MdPlayLesson />,
      path: `/content/courses?company=${companySlug}`,
    },
    {
      title: "Documentos",
      description: "Arquivos oficiais e materiais de apoio",
      icon: <IoMdDocument />,
      path: `/content/documentos?company=${companySlug}`,
    },
    {
      title: "Mídias Sociais",
      description: `Conteúdo oficial para redes sociais`,
      icon: <IoShareSocialSharp />,
      path: `/content/midiassociais?company=${companySlug}`,
    },
    {
      title: "FAQ",
      description: "Perguntas frequentes e respostas",
      icon: <RiQuestionnaireFill />,
      path: `/faq?company=${companySlug}`,
    },
    {
      title: "Vídeos",
      description: "Vídeos institucionais e operacionais",
      icon: <MdPlayCircle />,
      path: `/content/videos?company=${companySlug}`,
    },
  ];

  return (
    <div className="p-2">
      <Menu />
      <div className={`content-area company-${companySlug}`}>
        <div className="page-header">
          {/* Título Dinâmico com a cor da empresa */}
          <h2 className="content-title">Conteúdos da {companyInfo.name}</h2>
          <p>
            Selecione um módulo abaixo para acessar os conteúdos exclusivos.
          </p>
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
