import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
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

// Rotas públicas (sem menu / sem sessão obrigatória) onde o widget NÃO deve
// aparecer, mesmo que exista uma sessão ativa no navegador.
const PUBLIC_PATHS = ["/", "/reset-password", "/acompanhar"];

// IDs dos elementos que o widget.js cria diretamente no DOM.
const WIDGET_ELEMENT_IDS = ["__fw-btn", "__fw-overlay", "__fw-toast"];

// Mostra/esconde os elementos já injetados pelo widget.js. Como o widget.js é
// uma IIFE sem teardown, alternamos a visibilidade em vez de removê-lo.
const setWidgetVisible = (visible: boolean) => {
  WIDGET_ELEMENT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? "" : "none";
  });
};

// Injeta o widget flutuante de abertura de chamados (botão no canto inferior
// direito) apenas para usuários autenticados com papel diferente de
// "licenciado" e fora das rotas públicas. O widget.js cria o botão, o overlay
// e o iframe do formulário por conta própria.
const SupportWidget: React.FC = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    const shouldShow =
      !!user &&
      user.role !== "licenciado" &&
      !PUBLIC_PATHS.includes(pathname);

    if (!shouldShow) {
      // Deslogado, licenciado ou rota pública: garante que nada apareça.
      setWidgetVisible(false);
      return;
    }

    if (document.getElementById(WIDGET_SCRIPT_ID)) {
      // Widget já foi injetado numa navegação anterior — apenas reexibe.
      setWidgetVisible(true);
      return;
    }

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = `${API_BASE}/widget.js`;
    script.async = true;
    script.setAttribute("data-token", WIDGET_TOKEN);
    script.setAttribute("data-api", API_BASE);
    document.body.appendChild(script);
  }, [user, pathname]);

  return null;
};

export default SupportWidget;
