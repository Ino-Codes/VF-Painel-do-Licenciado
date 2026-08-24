import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";

interface ProtectedRouteProps {
  children: React.ReactNode;
  // Permissão de view exigida para abrir a tela. Se omitida, basta estar logado.
  permission?: string;
  // Alternativa: liberar se tiver QUALQUER uma destas permissões (para hubs).
  anyOf?: string[];
}

// Guard central: toda tela navegável só abre para quem tem o `.view` dela.
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  anyOf,
}) => {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  let allowed = true;
  if (permission) allowed = hasPermission(permission);
  else if (anyOf) allowed = hasAnyPermission(anyOf);

  if (!allowed) {
    // Sem a permissão da tela → volta para a Home (baseline de todos os grupos).
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
