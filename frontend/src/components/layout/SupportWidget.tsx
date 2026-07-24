import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContext.tsx";

// Token público do tenant "Painel V-CORP" — o mesmo do snippet do widget.
// Não é segredo: é enviado pelo próprio widget na abertura do chamado.
const WIDGET_TOKEN =
  "169542961bc795c6da2d17be6ebf11bf303ef1ffc31fedd3aca5f0de805cfec9";
const WIDGET_SCRIPT_ID = "vcorp-support-widget";

// O widget.js é servido pelo BACKEND (não pelo domínio do frontend), então
// carregamos da mesma base de API que o app usa. Funciona em produção e no
// localhost (backend em :3001).
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

// Injeta o widget flutuante de abertura de chamados (botão no canto inferior
// direito) apenas para usuários autenticados. O widget.js cria o botão, o
// overlay e o iframe do formulário por conta própria.
const SupportWidget: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (document.getElementById(WIDGET_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = `${API_BASE}/widget.js`;
    script.async = true;
    script.setAttribute("data-token", WIDGET_TOKEN);
    script.setAttribute("data-api", API_BASE);
    document.body.appendChild(script);
  }, [user]);

  return null;
};

export default SupportWidget;
