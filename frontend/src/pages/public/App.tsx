import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Logo from "../../img/textobranco2.png";
import { toast } from "react-hot-toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { AnimatePresence, motion } from "motion/react";
import { ENTRADA } from "../../utils/animacao.ts";

const App: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();

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

  // Se já existe sessão autenticada (token válido no localStorage), pula a tela
  // de login e vai direto para a Home. A troca de senha obrigatória do 1º
  // acesso é exigida pelo ProtectedRoute, em qualquer tela.
  useEffect(() => {
    if (!loading && user) {
      navigate("/home", { replace: true });
    }
  }, [loading, user, navigate]);

  // Sessão derrubada pelo backend (senha trocada em outro lugar).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sessao") === "encerrada") {
      toast("Sua sessão foi encerrada porque a senha foi alterada. Entre novamente.", {
        id: "sessao-encerrada",
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const formattedTime = `${Math.floor(secondsLeft / 60)}:${String(
    secondsLeft % 60,
  ).padStart(2, "0")}`;

  const finishLogin = (user: any, token: string) => {
    login(user, token); // Guarda os dados no localStorage e no contexto
    navigate("/home");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Retorno visual durante a validação
    try {
      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      // 1ª etapa OK → o backend enviou o código por e-mail. Avança para o
      // passo de verificação; o token só vem depois do /verify-2fa.
      if (res.data?.twoFactorRequired) {
        setStep("2fa");
        setCode("");
        setSecondsLeft(120);
        toast.success("Enviamos um código de verificação para o seu e-mail.");
      }
    } catch (err: any) {
      // 401 = credenciais inválidas; 429 = bloqueio temporário por excesso
      // de tentativas; 500 = falha ao enviar o código.
      const status = err?.response?.status;
      if (status === 500 || status === 429) {
        toast.error(
          err.response.data?.message ||
            "Erro no servidor. Tente novamente em instantes.",
        );
      } else if (/@valorfiscal\.com$/i.test(email.trim())) {
        // Maior causa de falha nos logs desde a mudança de marca.
        toast.error(
          "Os e-mails @valorfiscal.com não valem mais. Colaboradores entram com o e-mail @vcorporate.com.br; V-Partners, com o e-mail do cadastro.",
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
        email: email.trim(),
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
      await api.post("/api/auth/resend-2fa", { email: email.trim() });
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
        email: emailRecuperacao.trim(),
      });
      setRecoveryMessage(res.data.message);
    } catch (err) {
      setRecoveryMessage("Ocorreu um problema. Tente novamente mais tarde.");
      console.error("Erro ao solicitar redefinição de senha:", err);
    }
  };

  const toggleRecuperacao = () => {
    setMostrarRecuperacao(true);
  };

  const toggleLogin = () => {
    setMostrarRecuperacao(false);
    setRecoveryMessage("");
  };

  const tituloTela = mostrarRecuperacao
    ? "Recuperar Senha"
    : step === "2fa"
      ? "Verificação em duas etapas"
      : "Painel da V-CORP";

  // Evita exibir a tela de login enquanto a sessão é lida (loading) ou quando
  // já há sessão e o redirecionamento para /home está prestes a acontecer.
  if (loading || user) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <div className="login-page">
        {/* Abertura da marca: o logo sobe, o filete dourado corre e o
            slogan assenta. Toca uma vez e não atrasa quem quer só entrar. */}
        <aside className="login-hero">
          <motion.img
            className="login-hero-logo"
            alt="V-CORP"
            src={Logo}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: ENTRADA }}
          />
          <motion.span
            className="login-hero-divider"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, delay: 0.35, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.p
            className="login-hero-tagline"
            initial={{ opacity: 0, letterSpacing: "10px" }}
            animate={{ opacity: 1, letterSpacing: "4px" }}
            transition={{ duration: 0.7, delay: 0.55, ease: ENTRADA }}
          >
            Soluções Corporativas
          </motion.p>
        </aside>

        <div className="login-panel">
          <motion.div
            className="login-panel-inner"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: ENTRADA }}
          >
            <img className="login-panel-logo" alt="V-CORP" src={Logo} />
            <h2 className="titulo-login">{tituloTela}</h2>
            {!mostrarRecuperacao && step === "login" && (
              <p className="login-subtitle">
                Insira seu e-mail e senha para fazer login
              </p>
            )}

          {/* Login, código de verificação e recuperação trocam com um
              esmaecer curto, sem pular de uma vez. */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mostrarRecuperacao ? "recuperacao" : step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: ENTRADA }}
          >
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
                <button
                  type="button"
                  className="link-button"
                  onClick={toggleLogin}
                >
                  Voltar para o Login
                </button>
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
                <button
                  type="button"
                  className="link-button"
                  onClick={handleResend}
                >
                  Reenviar código
                </button>
              </p>
              <p className="auth-back-link">
                <button
                  type="button"
                  className="link-button"
                  onClick={voltarParaLogin}
                >
                  Voltar para o Login
                </button>
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
                <button
                  type="button"
                  className="link-button"
                  onClick={toggleRecuperacao}
                >
                  Esqueceu a senha?
                </button>
              </p>
            </form>
          )}
          </motion.div>
          </AnimatePresence>

            <p className="login-footer">
              V-CORP © {new Date().getFullYear()}. Todos os direitos
              reservados.
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default App;
