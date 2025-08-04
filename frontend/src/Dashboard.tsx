import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api.ts';
import { useAuth } from './context/AuthContext.tsx';
import Menu from './Menu.tsx';
import Footer from './Footer.tsx';
import toast from 'react-hot-toast';

interface Notice {
  id: number;
  message: string;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [notices, setNotices] = useState<Notice[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const fetchNotices = async () => {
    try {
      const res = await api.get('/api/notices');
      setNotices(res.data);
    } catch (err) {
      console.error('Erro ao buscar avisos:', err);
      toast.error('Não foi possível carregar os avisos.');
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotices();
    }
  }, [user]);

  const handlePostNotice = async () => {
    if (!newMessage.trim()) {
      toast.error('O aviso não pode estar em branco.');
      return;
    }
    try {
      await api.post('/api/admin/notice', { message: newMessage });
      setNewMessage(''); 
      fetchNotices(); 
      toast.success('Aviso postado com sucesso!');
    } catch (err) {
      toast.error('Erro ao postar o aviso.');
    }
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="dashboard-header">
          <h2>Bem-vindo, {user.nome}!</h2>
          <p>Este é o seu novo Painel do Licenciado</p>
        </div>

        <div className="dashboard-grid">
          
          <div className="notice-board">
            <h3>Mural de Avisos</h3>
            
            {user.role === 'admin' && (
              <div className="notice-form">
                <textarea
                  placeholder="Digite seu novo aviso aqui..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button className="form-button" onClick={handlePostNotice}>
                  Postar Aviso
                </button>
              </div>
            )}

            <div className="notice-list">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <div key={notice.id} className="notice-card">
                    <p>{notice.message}</p>
                    <small>
                      {new Date(notice.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </small>
                  </div>
                ))
              ) : (
                <p>Nenhum aviso no momento.</p>
              )}
            </div>
          </div>

          <div className="placeholder-column">
            <h3>Relatórios</h3>
            <div className="placeholder-content">
              <span>Gráficos e relatórios serão exibidos aqui em breve.</span>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;