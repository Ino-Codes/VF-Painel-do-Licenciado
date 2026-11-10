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
  // Link do convite de 1º acesso (conta nova): mesma tela, outro texto.
  const convite = searchParams.get("convite") === "1";
  const textos = convite
    ? {
        titulo: "Criar sua senha",
        subtitulo: "Bem-vindo ao Painel V-CORP! Crie a senha que você usará para entrar.",
        semToken: "Link de convite inválido. Peça ao administrador para reenviar o convite.",
        expirado:
          "Este link de convite expirou ou já foi usado. Peça ao administrador para reenviar o convite ou use “Esqueceu a senha?” no login.",
        botao: "Criar Senha",
        enviando: "Criando...",
        sucesso: "Senha criada! Entre com o seu e-mail e a nova senha.",
        falha: "Erro ao criar a senha.",
      }
    : {
        titulo: "Criar Nova Senha",
        subtitulo: null,
        semToken: "Token de redefinição não encontrado. Tente solicitar novamente.",
        expirado: null,
        botao: "Redefinir Senha",
        enviando: "Redefinindo...",
        sucesso: "Senha alterada com sucesso!",
        falha: "Erro ao redefinir a senha.",
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(textos.semToken);
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
      toast.success(convite ? textos.sucesso : res.data.message || textos.sucesso);
      navigate("/");
    } catch (err: any) {
      const doServidor: string | undefined = err.response?.data?.error;
      // O backend responde com a mensagem da redefinição; no convite, o
      // caminho para um link vencido é outro (pedir reenvio ao admin).
      const errorMessage =
        textos.expirado && doServidor?.startsWith("Token inválido ou expirado")
          ? textos.expirado
          : doServidor || textos.falha;
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
        <h2 className="titulo-login">{textos.titulo}</h2>

        {error && <div className="login-error-message">{error}</div>}

        {textos.subtitulo && <p className="login-subtitle">{textos.subtitulo}</p>}
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
            {submitting ? textos.enviando : textos.botao}
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
