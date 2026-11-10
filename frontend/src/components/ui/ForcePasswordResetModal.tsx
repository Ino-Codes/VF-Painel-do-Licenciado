import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { REGRA_SENHA, validarSenha } from "../../utils/senha.ts";

interface Props {
  email?: string;
  /** Recebe a sessão nova (usuário + token) emitida pelo backend. */
  onSuccess: (user: any, token: string) => void;
  /** Sair sem trocar (a troca continua pendente no próximo login). */
  onCancel?: () => void;
}

// Troca de senha obrigatória do 1º acesso. Aparece em qualquer tela enquanto
// a troca estiver pendente (ProtectedRoute) — o backend também bloqueia as
// outras rotas até lá.
const ForcePasswordResetModal: React.FC<Props> = ({ email, onSuccess, onCancel }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const erro = validarSenha(newPassword, email);
    if (erro) {
      toast.error(erro);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      const res = await api.put("/api/users/force-change-password", {
        password: newPassword,
      });
      toast.success("Senha definida com sucesso!");
      onSuccess(res.data.user, res.data.token);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Não foi possível atualizar a senha.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="troca-senha-titulo">
      <div className="modal-content">
        <h2 id="troca-senha-titulo">Definir Nova Senha</h2>
        <p>
          Por segurança, defina uma nova senha para o seu primeiro acesso.
        </p>
        <p className="senha-regra">{REGRA_SENHA}</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="password"
              aria-label="Nova senha"
              placeholder="Digite a sua nova senha"
              className="form-input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <input
              type="password"
              aria-label="Confirmar nova senha"
              placeholder="Confirme a nova senha"
              className="form-input"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            {onCancel && (
              <button type="button" className="form-button-cancel" onClick={onCancel}>
                Sair
              </button>
            )}
            <button type="submit" className="form-button" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar Nova Senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordResetModal;
