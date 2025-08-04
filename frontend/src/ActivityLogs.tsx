import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import api from './api.ts';
import Menu from './Menu.tsx';
import Footer from './Footer.tsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      navigate('/dashboard'); // Redireciona se não for admin
    }
  }, [user, loading, navigate]);

  const fetchLogs = async (page: number) => {
    try {
      const res = await api.get('/api/admin/logs', { params: { page, limit: 20 } });
      setLogs(res.data.logs);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error('Erro ao carregar os logs.');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchLogs(currentPage);
    }
  }, [user, currentPage]);

  if (loading || !user || user.role !== 'admin') {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Logs de Atividade do Sistema</h2>
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
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                  <td>{log.user_email || 'N/A'}</td>
                  <td>{log.action}</td>
                  <td>{log.details}</td>
                  <td>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-controls">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="page-buttons">
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>Anterior</button>
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}>Próxima</button>
            </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ActivityLogs;
