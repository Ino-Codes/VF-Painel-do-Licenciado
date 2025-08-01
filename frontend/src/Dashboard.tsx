import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api.ts';
import { useAuth } from './context/AuthContext.tsx';
import Menu from './Menu.tsx';
import Footer from './Footer.tsx';

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
              const [nRes, fRes] = await Promise.all([
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
    return <div className="tela-loading">Carregando...</div>
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
      <Footer />
    </div>
  );
};

export default Dashboard;