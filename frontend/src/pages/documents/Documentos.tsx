import React from "react";
import ContentLibrary from "../content/ContentLibrary.tsx";

// Biblioteca de documentos (recurso "files"). A UI vive em ContentLibrary,
// compartilhada com Arquivos.
const Documentos: React.FC = () => (
  <ContentLibrary
    resource="files"
    title="Central de Documentos"
    manageKey="files.manage"
    emptyImageKey="documentos"
    emptyTitle="Nenhum Documento Encontrado"
    emptyMessage="Estamos selecionando e incluindo novos documentos para facilitar sua rotina. Se não encontrar o que busca agora, dê uma passadinha aqui mais tarde!"
  />
);

export default Documentos;
