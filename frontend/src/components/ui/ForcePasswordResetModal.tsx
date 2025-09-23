import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface Props {
  onSuccess: () => void;
}

const ForcePasswordResetModal: React.FC<Props> = ({ onSuccess }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    try {
      await api.put("/api/users/force-change-password", {
        password: newPassword,
      });
      toast.success(
        "Senha atualizada com sucesso! Por favor, faça login novamente."
      );
      onSuccess();
    } catch (err) {
      toast.error("Não foi possível atualizar a senha.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Definir Nova Senha</h2>
        <p>
          Por segurança, você precisa de definir uma nova senha para o seu
          primeiro acesso.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="password"
              placeholder="Digite a sua nova senha"
              className="form-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <input
              type="password"
              placeholder="Confirme a nova senha"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="form-button">
              Salvar Nova Senha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordResetModal;
