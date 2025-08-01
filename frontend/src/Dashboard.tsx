import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api.ts';
import { useAuth } from './context/AuthContext.tsx';
import Menu from './Menu.tsx';

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/');
      } else {
        const fetchData = async () => {
          try {
            await Promise.all([
              api.get('/api/notices'),
              api.get('/api/files'),
            ]);
          } catch (err) {
            console.error('Erro ao buscar dados:', err);
          }
        };
        fetchData();
      }
    }
  }, [user, loading, navigate]); 
  
  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Bem-vindo, {user.nome}!</h2>
      </div>
    </div>
  );
};

export default Dashboard;