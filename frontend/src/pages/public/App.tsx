import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import ForcePasswordResetModal from "../../components/ui/ForcePasswordResetModal.tsx";
import Logo from "../../img/logo-clara.png";
import { toast } from "react-hot-toast";

const App: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Para acompanhar o processo de validação dos dados e dar retorno visual ao usuário
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { user, token } = res.data;

      login(user, token); // Guarda os dados no localStorage e no contexto

      if (user.must_change_password) {
        setNeedsPasswordReset(true); // Se precisar de mudar, abre o modal
      } else {
        navigate("/home"); // Se não, vai para o home
      }
    } catch (err) {
      toast.error("Revise os dados de login e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecuperarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperacao) {
      toast.error("Revise os dados de login e tente novamente.");
      return;
    }
    try {
      const res = await api.post("/api/auth/solicitar-redefinicao", {
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
  };

  const toggleLogin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMostrarRecuperacao(false);
    setRecoveryMessage("");
  };

  const onPasswordResetSuccess = () => {
    setNeedsPasswordReset(false);
    logout(); // Força o logout para que o usuário entre com a nova senha
  };

  return (
    <>
      <div className="p-login">
        <div className="p-img">
          <img alt="Logo da Valor Fiscal" src={Logo} />
        </div>
        <div className="p-1">
          <h2 className="titulo-login">
            {!mostrarRecuperacao ? "Painel da Valor Fiscal" : "Recuperar Senha"}
          </h2>

          {!mostrarRecuperacao ? (
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                className="input-login"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
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
                }}
                required
              />
              <button
                className="botao-login"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Logando..." : "Login"}
              </button>
              <p className="esqueceu-senha">
                <a href="#" onClick={toggleRecuperacao}>
                  Esqueci minha senha
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
                    Informe seu e-mail para receber o link de redefinição.
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
      {/* O modal de redefinição de senha é renderizado aqui se necessário */}
      {needsPasswordReset && (
        <ForcePasswordResetModal onSuccess={onPasswordResetSuccess} />
      )}
    </>
  );
};

export default App;
