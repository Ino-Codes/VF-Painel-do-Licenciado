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

  const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

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

  const handleDeleteNotice = async (noticeId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este aviso?')) {
      try {
        await api.delete(`/api/admin/notices/${noticeId}`);
        toast.success('Aviso excluído com sucesso!');
        fetchNotices();
      } catch (err) {
        toast.error('Erro ao excluir o aviso.');
      }
    }
  };

  const handleEditNotice = (notice: Notice) => {
    setEditingNoticeId(notice.id);
    setEditText(notice.message);
  };

  const handleUpdateNotice = async (noticeId: number) => {
    if (!editText.trim()) {
      toast.error('O aviso não pode estar em branco.');
      return;
    }
    try {
      await api.put(`/api/admin/notices/${noticeId}`, { message: editText });
      toast.success('Aviso atualizado com sucesso!');
      setEditingNoticeId(null);
      setEditText('');
      fetchNotices();
    } catch (err) {
      toast.error('Erro ao atualizar o aviso.');
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
                    {editingNoticeId === notice.id ? (
                      <div className="notice-edit-form">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <div className="notice-actions">
                           <button className="list-button" onClick={() => setEditingNoticeId(null)}>Cancelar</button>
                           <button className="list-button edit" onClick={() => handleUpdateNotice(notice.id)}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{notice.message}</p>
                        <div className="notice-footer">
                          <small>
                            {new Date(notice.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </small>
                          {user.role === 'admin' && (
                            <div className="notice-actions">
                              <button className="list-button edit" onClick={() => handleEditNotice(notice)}>Editar</button>
                              <button className="list-button delete" onClick={() => handleDeleteNotice(notice.id)}>Excluir</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
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