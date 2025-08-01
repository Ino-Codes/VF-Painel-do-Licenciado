import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api.ts';
import { useAuth } from './context/AuthContext.tsx';
import Menu from './Menu.tsx';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/');
    }

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
  }, [user, navigate]);

  if (!user) return null;

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