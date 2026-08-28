import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import api from "../api.ts";
import { CompanySlug } from "../types.ts";
import { safeStorage } from "../utils/safeStorage.ts";

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
        safeStorage.set("userData", JSON.stringify(res.data.user));
      }
    } catch {
      // silencioso: se falhar (ex.: token expirado), o fluxo normal trata
    }
  };

  useEffect(() => {
    const token = safeStorage.get("token");
    const userData = safeStorage.get("userData");
    const savedCompany = safeStorage.get("currentCompany") as CompanySlug | null;

    let parsedUser: User | null = null;
    if (userData) {
      try {
        parsedUser = JSON.parse(userData);
      } catch {
        parsedUser = null; // dado corrompido → trata como sem sessão
      }
    }

    if (token && parsedUser && !isTokenExpired(token)) {
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
      // Sessão ausente/expirada/corrompida → limpa restos para login limpo.
      safeStorage.remove("token");
      safeStorage.remove("userData");
      safeStorage.remove("currentCompany");
    }
    setLoading(false);
  }, []);

  // Ressincroniza as permissões quando a aba volta ao foco.
  useEffect(() => {
    const onFocus = () => {
      const token = safeStorage.get("token");
      if (token && !isTokenExpired(token)) refreshUser();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const login = (userData: User, token?: string) => {
    // Preserva o token atual quando a chamada não envia um novo (ex.: apenas
    // atualização de dados do usuário). Evita gravar "undefined" como token e
    // corromper o cabeçalho Authorization.
    const finalToken = token || safeStorage.get("token") || "";
    if (finalToken) {
      safeStorage.set("token", finalToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${finalToken}`;
    }
    safeStorage.set("userData", JSON.stringify(userData));
    setUser(userData);

    setCurrentCompany(userData.company_slug || "v-tax");
  };

  const logout = () => {
    safeStorage.remove("token");
    safeStorage.remove("userData");
    safeStorage.remove("currentCompany");
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
    window.location.href = "/";
  };

  const switchCompany = (slug: CompanySlug) => {
    setCurrentCompany(slug);
    safeStorage.set("currentCompany", slug);
  };

  // Memoizados por `user`: identidade estável entre renders (sem trocar de
  // usuário), permitindo que consumidores os incluam nas deps de efeitos sem
  // stale-closure nem loops.
  const hasPermission = useCallback(
    (key: string): boolean =>
      Array.isArray(user?.permissions) && user!.permissions.includes(key),
    [user],
  );

  const hasAnyPermission = useCallback(
    (keys: string[]): boolean =>
      Array.isArray(user?.permissions) &&
      keys.some((k) => user!.permissions!.includes(k)),
    [user],
  );

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
