import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";

const Perfil: React.FC = () => {
  const { user, login, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/");
      } else {
        setNome(user.nome);
      }
    }
  }, [user, loading, navigate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    const formData = new FormData();
    formData.append("avatar", selectedFile);
    try {
      const res = await api.post(`/api/users/${user.id}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedUser = { ...user, avatar_url: res.data.avatarUrl };
      login(updatedUser);
      toast.success("Foto de perfil atualizada com sucesso!");
      setSelectedFile(null);
    } catch (err) {
      toast.error("Erro ao atualizar a foto.");
      console.error(err);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !nome.trim()) {
      toast.error("O nome não pode estar vazio.");
      return;
    }
    try {
      const res = await api.put(`/api/users/${user.id}/profile`, { nome });
      const updatedUser = res.data.user;
      login(updatedUser);
      toast.success("Nome atualizado com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar as alterações.");
      console.error(err);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (newPassword !== confirmPassword) {
      toast.error("A nova senha e a confirmação não correspondem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      await api.put(`/api/users/${user.id}/change-password`, {
        currentPassword,
        newPassword,
      });
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || "Erro ao alterar a senha.";
      toast.error(errorMessage);
      console.error(err);
    }
  };

  const handleRemoveAvatarClick = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRemoveAvatar = async () => {
    if (!user) return;
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user);
      toast.success("Foto de perfil removida com sucesso!");
    } catch (err) {
      toast.error("Erro ao remover a foto.");
      console.error(err);
    } finally {
      setIsConfirmModalOpen(false);
    }
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Meu Perfil</h2>
        <div className="profile-card">
          <div className="avatar-section">
            <img
              src={
                user.avatar_url ||
                "https://res.cloudinary.com/dsgbgrll5/image/upload/v1754077476/imagem-do-usuario-com-fundo-preto_kcuzbg.png"
              }
              alt="Foto de Perfil"
              className="profile-avatar"
            />
            <input type="file" onChange={handleFileChange} />
            {selectedFile && (
              <button onClick={handleUpload} className="form-button">
                Salvar Nova Foto
              </button>
            )}
            {user.avatar_url && !selectedFile && (
              <button
                onClick={handleRemoveAvatarClick}
                className="delete-button"
              >
                Remover Foto
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
            <button className="form-button" onClick={handleSaveChanges}>
              Salvar Alterações
            </button>

            <div className="password-section">
              <h3>Alterar Senha</h3>
              <div className="form-row">
                <label htmlFor="current-password">Senha Atual:</label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <label htmlFor="new-password">Nova Senha:</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <label htmlFor="confirm-password">Confirmar Senha:</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <button className="form-button" onClick={handleChangePassword}>
                Alterar Senha
              </button>
            </div>
          </div>
        </div>
        <button
          className="botao-logout"
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          Desconectar
        </button>
      </div>
      <Footer />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmRemoveAvatar}
        title="Remover Foto de Perfil"
        message="Tem certeza que deseja remover sua foto de perfil?"
      />
    </div>
  );
};

export default Perfil;
