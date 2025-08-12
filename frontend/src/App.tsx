import React, { useState } from "react";
import api from "./api.ts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.tsx";

const logo =
  "https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png";

const App: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [loginError, setLoginError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginError("");
      const res = await api.post("/api/login", { email, password });
      login(res.data);
      navigate("/dashboard");
    } catch (err) {
      setLoginError("Revise os dados de login e tente novamente.");
    }
  };

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperacao) {
      setLoginError("Por favor, insira um e-mail.");
      return;
    }
    try {
      setLoginError("");
      const res = await api.post("/api/solicitar-redefinicao", {
        email: emailRecuperacao,
      });
      setRecoveryMessage(res.data.message);
    } catch (err) {
      setRecoveryMessage("Ocorreu um problema. Tente novamente mais tarde.");
      console.error("Erro ao solicitar redefinição de senha:", err);
    }
  };

  const toggleRecuperacao = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMostrarRecuperacao(true);
    setLoginError("");
  };

  const toggleLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMostrarRecuperacao(false);
    setRecoveryMessage("");
    setLoginError("");
  };

  return (
    <div className="p-login">
      <div className="p-img">
        <img alt="Logo da Valor Fiscal" src={logo} />
      </div>
      <div className="p-1">
        <h2 className="titulo-login">
          {!mostrarRecuperacao ? "Painel Valor Fiscal" : "Recuperar Senha"}
        </h2>

        {loginError && <div className="login-error-message">{loginError}</div>}

        {!mostrarRecuperacao ? (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              className="input-login"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (loginError) setLoginError("");
              }}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              className="input-login"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (loginError) setLoginError("");
              }}
              required
            />
            <button className="botao-login" type="submit">
              Login
            </button>
            <p className="esqueceu-senha">
              <a href="#" onClick={toggleRecuperacao}>
                Esqueceu sua senha?
              </a>
            </p>
          </form>
        ) : (
          <>
            {!recoveryMessage ? (
              <form onSubmit={handleRecuperarSenha}>
                <p
                  style={{
                    fontSize: "14px",
                    maxWidth: "280px",
                    margin: "0 auto 20px",
                  }}
                >
                  Digite seu e-mail para receber o link de redefinição.
                </p>
                <input
                  type="email"
                  placeholder="Digite seu e-mail"
                  className="input-login"
                  value={emailRecuperacao}
                  onChange={(e) => setEmailRecuperacao(e.target.value)}
                  required
                />
                <button className="botao-login" type="submit">
                  Enviar
                </button>
              </form>
            ) : (
              <p className="feedback-message">{recoveryMessage}</p>
            )}
            <p style={{ marginTop: "20px" }}>
              <a href="#" onClick={toggleLogin}>
                Voltar para o Login
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
