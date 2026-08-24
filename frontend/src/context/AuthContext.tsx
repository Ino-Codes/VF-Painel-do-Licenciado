import React, { createContext, useState, useEffect, useContext } from "react";
import api from "../api.ts";
import { CompanySlug } from "../types.ts";

export interface User {
  id: number;
  email: string;
  nome: string;
  nickname: string;
  // role é mantido apenas como espelho legado do grupo; a autorização usa
  // `permissions`. Pode ser qualquer slug de grupo (inclusive customizados).
  role: string;
  group_id?: number | null;
  group_name?: string | null;
  permissions?: string[];
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
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
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

  // Busca dados atualizados do usuário (inclui permissões) sem exigir login.
  // Mantém a UI em sincronia quando o admin edita permissões de um grupo.
  const refreshUser = async () => {
    try {
      const res = await api.get("/api/auth/me");
      if (res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem("userData", JSON.stringify(res.data.user));
      }
    } catch {
      // silencioso: se falhar (ex.: token expirado), o fluxo normal trata
    }
  };

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
      // Atualiza permissões em segundo plano.
      refreshUser();
    } else if (token || userData) {
      // Sessão ausente/expirada → limpa restos para cair no login limpo.
      localStorage.removeItem("token");
      localStorage.removeItem("userData");
      localStorage.removeItem("currentCompany");
    }
    setLoading(false);
  }, []);

  // Ressincroniza as permissões quando a aba volta ao foco.
  useEffect(() => {
    const onFocus = () => {
      const token = localStorage.getItem("token");
      if (token && !isTokenExpired(token)) refreshUser();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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

  const hasPermission = (key: string): boolean =>
    Array.isArray(user?.permissions) && user!.permissions.includes(key);

  const hasAnyPermission = (keys: string[]): boolean =>
    Array.isArray(user?.permissions) &&
    keys.some((k) => user!.permissions!.includes(k));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        currentCompany,
        switchCompany,
        hasPermission,
        hasAnyPermission,
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
