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
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_DURATION_HOURS = 24;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('userSession');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        const now = new Date().getTime();

        if (now > sessionData.expiry) {
          localStorage.removeItem('userSession');
        } else {
          setUser(sessionData.user);
        }
      }
    } catch (error) {
      console.error("Erro ao ler sessão:", error);
      localStorage.removeItem('userSession');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    const now = new Date();
    const expiry = now.getTime() + (SESSION_DURATION_HOURS * 60 * 60 * 1000);
    const sessionData = { user: userData, expiry };
    setUser(userData);
    localStorage.setItem('userSession', JSON.stringify(sessionData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('userSession');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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