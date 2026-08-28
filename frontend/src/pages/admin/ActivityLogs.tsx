import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";

interface Log {
  id: number;
  user_email: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

// Humaniza as ações em estilo ENUM (UPPER_SNAKE_CASE) para pt-BR. Ações que já
// vêm legíveis (ex.: "Login Bem-Sucedido") passam intactas.
// FILE = Documentos, ARCHIVE = Arquivos (nomenclatura das telas de conteúdo).
const ACTION_LABELS: Record<string, string> = {
  CREATE_FILE: "Documento Criado",
  UPDATE_FILE: "Documento Editado",
  DELETE_FILE: "Documento Excluído",
  DOWNLOAD_FILE: "Documento Baixado",
  CREATE_ARCHIVE: "Arquivo Criado",
  UPDATE_ARCHIVE: "Arquivo Editado",
  DELETE_ARCHIVE: "Arquivo Excluído",
  DOWNLOAD_ARCHIVE: "Arquivo Baixado",
  UPDATE_SOCIAL_POST: "Conteúdo Social Editado",
  DELETE_SOCIAL_POST: "Conteúdo Social Excluído",
  WIDGET_TENANT_CRIADO: "Widget: Cliente Criado",
  WIDGET_TENANT_EDITADO: "Widget: Cliente Editado",
  WIDGET_TENANT_EXCLUIDO: "Widget: Cliente Excluído",
  WIDGET_TOKEN_REGENERADO: "Widget: Token Regenerado",
};
const formatAction = (action: string) => ACTION_LABELS[action] || action;

const ActivityLogs: React.FC = () => {
  const { user, loading } = useAuth();

  const [logs, setLogs] = useState<Log[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params: any = {
        page: currentPage,
        limit: 20,
      };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get("/api/admin/logs", { params });
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      toast.error("Erro ao carregar os logs.");
    }
  }, [user, currentPage, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSearch = () => {
    setSearchQuery(searchTerm.trim());
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Logs de Atividade do Sistema</h2>
        </div>

        <div className="search-bar">
          <input
            type="search"
            placeholder="Buscar por data, email, ação ou detalhes..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="form-button" onClick={handleSearch}>
            Pesquisar
          </button>
        </div>

        {loadError ? (
          <div className="tela-loading">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </div>
        ) : (
        <div className="logs-table-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Operador</th>
                <th>Ação</th>
                <th>Detalhes</th>
                <th>Endereço IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                  <td>{log.user_email || "N/A"}</td>
                  <td>{formatAction(log.action)}</td>
                  <td>{log.details}</td>
                  <td>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {totalPages > 0 && (
          <div className="pagination-controls">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="list-button"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="list-button"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ActivityLogs;
