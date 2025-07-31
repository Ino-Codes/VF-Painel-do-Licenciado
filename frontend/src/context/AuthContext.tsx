import React, { createContext, useState, useEffect, useContext } from 'react';

interface User {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'licenciado' | 'gestor';
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_DURATION_HOURS = 24;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Efeito para carregar a sessão do localStorage ao iniciar
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('userSession');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const now = new Date().getTime();

        // Verifica se a sessão expirou
        if (now > sessionData.expiry) {
          console.log('Sessão expirada, limpando...');
          localStorage.removeItem('userSession');
          setUser(null);
        } else {
          // Se a sessão for válida, define o usuário
          setUser(sessionData.user);
        }
      }
    } catch (error) {
      console.error("Erro ao ler a sessão do localStorage", error);
      localStorage.removeItem('userSession'); // Limpa em caso de erro de parse
    }
  }, []); // Executa apenas uma vez, quando o componente é montado

  // Função de login e ATUALIZAÇÃO de dados do usuário
  const login = (userData: User) => {
    const now = new Date();
    const expiry = now.getTime() + (SESSION_DURATION_HOURS * 60 * 60 * 1000);

    const sessionData = {
      user: userData, // Salva o objeto de usuário completo
      expiry: expiry,
    };

    // 1. Atualiza o estado em memória
    setUser(userData);
    // 2. Salva a sessão completa e atualizada no localStorage
    localStorage.setItem('userSession', JSON.stringify(sessionData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userSession');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};