import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

interface Log {
  id: number;
  user_email: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

const ActivityLogs: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<Log[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchLogs = useCallback(async () => {
    if (user?.role !== "admin") return;
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
    } catch (err) {
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

  if (loading || !user || user.role !== "admin") {
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

        <div className="logs-table-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
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
                  <td>{log.action}</td>
                  <td>{log.details}</td>
                  <td>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
