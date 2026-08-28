import React from "react";
import ContentLibrary from "../content/ContentLibrary.tsx";

// Biblioteca de arquivos (recurso "archives"). A UI vive em ContentLibrary,
// compartilhada com Documentos.
const Arquivos: React.FC = () => (
  <ContentLibrary
    resource="archives"
    title="Arquivos"
    manageKey="archives.manage"
    emptyImageKey="arquivos"
    emptyTitle="Nenhum Arquivo Encontrado"
    emptyMessage="Nenhum arquivo foi cadastrado nesta seção ainda."
  />
);

export default Arquivos;
