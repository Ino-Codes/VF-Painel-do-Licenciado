import React, { useState } from 'react';
import api from './api.ts';
import { useNavigate } from 'react-router-dom';
import logoclara from './img/logo-clara.png';
import { useAuth } from './context/AuthContext.tsx';

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

  const handleRecuperarSenha = async () => {
    if (!emailRecuperacao) {
      setLoginError('Por favor, insira um e-mail.');
      return;
    }
    try {
      setLoginError('');
      await api.post('/api/redefinir-senha', { email: emailRecuperacao });
      setRecoveryMessage('Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.');
    } catch (err) {
      setRecoveryMessage('Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.');
      console.error('Erro ao solicitar redefinição de senha:', err);
    }
  };

  return (
    <div className="p-login">
      <div className="p-img">
        <img alt="Logo da Valor Fiscal" src={logoclara} />
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
            <p><a href="#" onClick={() => setMostrarRecuperacao(true)}>Esqueceu sua senha?</a></p>
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