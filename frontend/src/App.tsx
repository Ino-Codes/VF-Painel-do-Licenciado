import React, { useState } from 'react';
import api from './api.ts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const logo = 'https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png';

const App: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarRecuperacao, setMostrarRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [loginError, setLoginError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      setLoginError('');
      const res = await api.post('/api/login', { email, password });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setLoginError('Revise os dados de login e tente novamente.');
    }
  };

  // Em App.tsx, na função handleRecuperarSenha
  const handleRecuperarSenha = async () => {
    if (!emailRecuperacao) {
      // Use o estado de erro existente para feedback
      setLoginError('Por favor, insira um e-mail.');
      return;
    }
    try {
      setLoginError('');
      // Chame a nova rota do backend
      const res = await api.post('/api/solicitar-redefinicao', { email: emailRecuperacao });
      setRecoveryMessage(res.data.message);
    } catch (err) {
      // Em caso de erro de servidor, mostre uma mensagem genérica
      setRecoveryMessage('Ocorreu um problema. Tente novamente mais tarde.');
      console.error('Erro ao solicitar redefinição de senha:', err);
    }
  };

  return (
    <div className="p-login">
      <div className="p-img">
        <img alt="Logo da Valor Fiscal" src={logo} />
      </div>
      <div className="p-1">
        <h2 className="titulo-login">{!mostrarRecuperacao ? 'Painel do Licenciado' : 'Recuperar Senha'}</h2>

        {loginError && <div className="login-error-message">{loginError}</div>}
        
        {!mostrarRecuperacao ? (
          <>
            <input
              type="email"
              placeholder="Email"
              className="input-login"
              onChange={e => {
                setEmail(e.target.value);
                if (loginError) setLoginError('');
              }}
            />
            <input
              type="password"
              placeholder="Senha"
              className="input-login"
              onChange={e => {
                setPassword(e.target.value);
                if (loginError) setLoginError('');
              }}
            />
            <button className="botao-login" onClick={handleLogin}>Login</button>           
            <p className="esqueceu-senha"><a href="#" onClick={() => setMostrarRecuperacao(true)}>Esqueceu sua senha?</a></p>
          </>
        ) : (
          <>
            {!recoveryMessage ? (
              <>
                <input
                  type="email"
                  placeholder="Digite seu e-mail"
                  className="input-login"
                  value={emailRecuperacao}
                  onChange={e => setEmailRecuperacao(e.target.value)}
                />
                <button className="botao-login" onClick={handleRecuperarSenha}>Enviar</button>
              </>
            ) : (
              <p className="feedback-message">{recoveryMessage}</p>
            )}
            <p><a href="#" onClick={() => { setMostrarRecuperacao(false); setRecoveryMessage(''); }}>Voltar para o Login</a></p>
          </>
        )}
      </div>
    </div>
  );
};

export default App;