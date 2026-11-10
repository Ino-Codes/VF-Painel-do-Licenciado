import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { REGRA_SENHA, validarSenha } from "../../utils/senha.ts";

const logo =
  "https://res.cloudinary.com/dsgbgrll5/image/upload/v1782936553/textobranco_zxw32o.png";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(
        "Token de redefinição não encontrado. Tente solicitar novamente.",
      );
      return;
    }
    const erroSenha = validarSenha(password);
    if (erroSenha) {
      setError(erroSenha);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/redefinir-senha", {
        token,
        password,
      });
      toast.success(res.data.message || "Senha alterada com sucesso!");
      navigate("/");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || "Erro ao redefinir a senha.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-login">
      <div className="p-img">
        <img alt="Logo da V-CORP" src={logo} />
      </div>
      <div className="p-1">
        <h2 className="titulo-login">Criar Nova Senha</h2>

        {error && <div className="login-error-message">{error}</div>}

        <p className="login-subtitle">{REGRA_SENHA}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nova Senha"
            className="input-login"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmar Nova Senha"
            className="input-login"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button className="botao-login" type="submit" disabled={submitting}>
            {submitting ? "Redefinindo..." : "Redefinir Senha"}
          </button>
        </form>

        <p className="auth-back-link">
          <Link to="/">Voltar para o Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
