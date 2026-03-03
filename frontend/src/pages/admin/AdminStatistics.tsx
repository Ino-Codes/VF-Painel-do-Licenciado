import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import {
  HiOutlineUsers,
  HiOutlineDownload,
  HiOutlineDocumentText,
  HiOutlineStatusOnline,
} from "react-icons/hi";

import { MdRefresh } from "react-icons/md";

interface SystemStats {
  todayLogins: number;
  totalInternalUsers: number;
  totalLicenciados: number;
  totalDownloads: number;
  topDownloads: { name: string; count: number }[];
}

const AdminStatistics: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchStats = async () => {
    setIsLoadingData(true);
    try {
      const res = await api.get("/api/admin/analytics/system-usage");
      setStats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar estatísticas.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) fetchStats();

    // Opcional: Atualizar a cada 60 segundos para efeito "tempo real"
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Estatísticas do Sistema</h2>
          <p>Visão geral de uso e engajamento da plataforma.</p>
          <button className="form-icon-edit" onClick={fetchStats}>
            <MdRefresh /> Atualizar
          </button>
        </div>

        {isLoadingData ? (
          <div className="tela-loading" style={{ height: "200px" }}>
            Carregando dados...
          </div>
        ) : stats ? (
          <div className="stats-dashboard">
            {/* --- CARDS DE MÉTRICAS --- */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <HiOutlineStatusOnline />
                </div>
                <div className="stat-info">
                  <h3>{stats.todayLogins}</h3>
                  <p>Logins Hoje</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <HiOutlineDownload />
                </div>
                <div className="stat-info">
                  <h3>{stats.totalDownloads}</h3>
                  <p>Total de Downloads</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <HiOutlineUsers />
                </div>
                <div className="stat-info">
                  <h3>{stats.totalLicenciados}</h3>
                  <p>Licenciados Cadastrados</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <HiOutlineUsers />
                </div>
                <div className="stat-info">
                  <h3>{stats.totalInternalUsers}</h3>
                  <p>Colaboradores Internos</p>
                </div>
              </div>
            </div>

            {/* --- LISTA DE TOP DOWNLOADS --- */}
            <div className="admin-section">
              <h3>Arquivos Mais Baixados</h3>
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nome do Arquivo</th>
                      <th style={{ textAlign: "center" }}>Qtd. Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topDownloads.map((file, index) => (
                      <tr key={index}>
                        <td className="file-cell">
                          <HiOutlineDocumentText
                            size={20}
                            color="var(--text-secondary)"
                          />
                          {file.name}
                        </td>

                        <td style={{ textAlign: "center", fontWeight: "500" }}>
                          <span className="count-badge">{file.count}</span>
                        </td>
                      </tr>
                    ))}
                    {stats.topDownloads.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          Nenhum download registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p>Não foi possível carregar os dados.</p>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AdminStatistics;
