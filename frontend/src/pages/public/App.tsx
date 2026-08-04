import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import ForcePasswordResetModal from "../../components/ui/ForcePasswordResetModal.tsx";
import Logo from "../../img/textobranco2.png";
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

  // ── Verificação em duas etapas (2FA) ──
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Contador regressivo de validade do código (2 min).
  useEffect(() => {
    if (step !== "2fa") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const formattedTime = `${Math.floor(secondsLeft / 60)}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;

  const finishLogin = (user: any, token: string) => {
    login(user, token); // Guarda os dados no localStorage e no contexto
    if (user.must_change_password) {
      setNeedsPasswordReset(true); // Se precisar mudar, abre o modal
    } else {
      navigate("/home");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Retorno visual durante a validação
    try {
      const res = await api.post("/api/auth/login", { email, password });

      // 1ª etapa OK → o backend enviou o código por e-mail. Avança para o
      // passo de verificação; o token só vem depois do /verify-2fa.
      if (res.data?.twoFactorRequired) {
        setStep("2fa");
        setCode("");
        setSecondsLeft(120);
        toast.success("Enviamos um código de verificação para o seu e-mail.");
      }
    } catch (err: any) {
      // 401 = credenciais inválidas; 500 = falha ao enviar o código.
      if (err?.response?.status === 500) {
        toast.error(
          err.response.data?.message ||
            "Erro no servidor. Tente novamente em instantes.",
        );
      } else {
        toast.error("Revise os dados de login e tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setIsLoading(true);
    try {
      const res = await api.post("/api/auth/verify-2fa", {
        email,
        code: code.trim(),
      });
      const { user, token } = res.data;
      finishLogin(user, token);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Código incorreto. Tente novamente.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post("/api/auth/resend-2fa", { email });
      setCode("");
      setSecondsLeft(120);
      toast.success("Novo código enviado para o seu e-mail.");
    } catch {
      toast.error("Não foi possível reenviar o código. Tente novamente.");
    }
  };

  const voltarParaLogin = () => {
    setStep("login");
    setCode("");
    setPassword("");
    setSecondsLeft(0);
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

  const tituloTela = mostrarRecuperacao
    ? "Recuperar Senha"
    : step === "2fa"
      ? "Verificação em duas etapas"
      : "Painel da V-CORP";

  return (
    <>
      <div className="login-page">
        <aside className="login-hero">
          <img className="login-hero-logo" alt="V-CORP" src={Logo} />
          <span className="login-hero-divider" />
          <p className="login-hero-tagline">Soluções Corporativas</p>
        </aside>

        <div className="login-panel">
          <div className="login-panel-inner">
            <img className="login-panel-logo" alt="V-CORP" src={Logo} />
            <h2 className="titulo-login">{tituloTela}</h2>
            {!mostrarRecuperacao && step === "login" && (
              <p className="login-subtitle">
                Insira seu e-mail e senha para fazer login
              </p>
            )}

          {mostrarRecuperacao ? (
            <>
              {!recoveryMessage ? (
                <form onSubmit={handleRecuperarSenha}>
                  <p className="login-subtitle">
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
              <p className="auth-back-link">
                <a href="#" onClick={toggleLogin}>
                  Voltar para o Login
                </a>
              </p>
            </>
          ) : step === "2fa" ? (
            <form onSubmit={handleVerify}>
              <p className="login-subtitle">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Código de verificação"
                className="input-login"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoFocus
                required
              />

              <p className="login-2fa-timer">
                {secondsLeft > 0 ? (
                  <>
                    O código expira em <strong>{formattedTime}</strong>.
                  </>
                ) : (
                  <>O código expirou. Reenvie para receber um novo.</>
                )}
              </p>

              <button
                className="botao-login"
                type="submit"
                disabled={isLoading || code.length < 6}
              >
                {isLoading ? "Verificando..." : "Verificar"}
              </button>

              <p className="esqueceu-senha">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleResend();
                  }}
                >
                  Reenviar código
                </a>
              </p>
              <p className="auth-back-link">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    voltarParaLogin();
                  }}
                >
                  Voltar para o Login
                </a>
              </p>
            </form>
          ) : (
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
                  Esqueceu a senha?
                </a>
              </p>
            </form>
          )}

            <p className="login-footer">
              V-CORP © {new Date().getFullYear()}. Todos os direitos
              reservados.
            </p>
          </div>
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
