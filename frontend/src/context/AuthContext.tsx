import React, { createContext, useState, useEffect, useContext } from "react";
import api from "../api.ts";
import { CompanySlug } from "../types.ts";

interface User {
  id: number;
  email: string;
  nome: string;
  nickname: string;
  role: "admin" | "licenciado" | "rh";
  avatar_url?: string;
  must_change_password?: boolean;
  company_slug: CompanySlug;
  allowed_companies?: CompanySlug[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentCompany: CompanySlug;
  switchCompany: (slug: CompanySlug) => void;
  login: (userData: User, token?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Verifica a expiração (claim `exp`) do JWT sem depender de biblioteca.
// Retorna true se o token estiver expirado ou for inválido.
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload?.exp) return false; // sem exp → não força expiração
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true; // token malformado → tratar como expirado
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentCompany, setCurrentCompany] =
    useState<CompanySlug>("v-tax");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("userData");
    const savedCompany = localStorage.getItem("currentCompany") as CompanySlug;

    if (token && userData && !isTokenExpired(token)) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      if (savedCompany) {
        setCurrentCompany(savedCompany);
      } else if (parsedUser.company_slug) {
        setCurrentCompany(parsedUser.company_slug);
      }
    } else if (token || userData) {
      // Sessão ausente/expirada → limpa restos para cair no login limpo.
      localStorage.removeItem("token");
      localStorage.removeItem("userData");
      localStorage.removeItem("currentCompany");
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token?: string) => {
    // Preserva o token atual quando a chamada não envia um novo (ex.: apenas
    // atualização de dados do usuário). Evita gravar "undefined" como token e
    // corromper o cabeçalho Authorization.
    const finalToken = token || localStorage.getItem("token") || "";
    if (finalToken) {
      localStorage.setItem("token", finalToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${finalToken}`;
    }
    localStorage.setItem("userData", JSON.stringify(userData));
    setUser(userData);

    setCurrentCompany(userData.company_slug || "v-tax");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    localStorage.removeItem("currentCompany");
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
    window.location.href = "/";
  };

  const switchCompany = (slug: CompanySlug) => {
    setCurrentCompany(slug);
    localStorage.setItem("currentCompany", slug);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        currentCompany,
        switchCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
