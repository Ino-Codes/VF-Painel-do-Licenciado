import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import api from './api';
import Menu from './Menu';
import { useNavigate } from 'react-router-dom';

const Perfil: React.FC = () => {
  const { user, login } = useAuth(); // Usaremos 'login' para atualizar o contexto
  const navigate = useNavigate();
  
  const [nome, setNome] = useState(user?.nome || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    const formData = new FormData();
    formData.append('avatar', selectedFile);

    try {
      const res = await api.post(`/api/users/${user.id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Atualiza o contexto do usuário com a nova URL do avatar
      const updatedUser = { ...user, avatar_url: res.data.avatarUrl };
      login(updatedUser); // A função login do contexto também atualiza os dados

      setMessage('Foto de perfil atualizada com sucesso!');
      setSelectedFile(null);
    } catch (err) {
      setMessage('Erro ao atualizar a foto.');
      console.error(err);
    }
  };

  if (!user) {
    return null; // Não renderiza nada se o usuário não estiver logado
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Meu Perfil</h2>

        <div className="profile-card">
          <div className="avatar-section">
            <img 
              src={user.avatar_url || 'https://via.placeholder.com/150'} 
              alt="Foto de Perfil" 
              className="profile-avatar"
            />
            <input type="file" onChange={handleFileChange} />
            {selectedFile && (
              <button onClick={handleUpload} className="form-button">
                Salvar Nova Foto
              </button>
            )}
          </div>

          <div className="details-section">
            <h3>Editar Informações</h3>
            <div className="form-row">
              <label htmlFor="nome">Nome:</label>
              <input 
                id="nome"
                type="text" 
                value={nome} 
                onChange={(e) => setNome(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-row">
               <label htmlFor="email">Email:</label>
               <input 
                id="email"
                type="email" 
                value={user.email} 
                disabled 
                className="form-input"
              />
            </div>
            <button className="form-button">Salvar Alterações</button>
          </div>
        </div>

        {message && <p>{message}</p>}
      </div>
    </div>
  );
};

export default Perfil;