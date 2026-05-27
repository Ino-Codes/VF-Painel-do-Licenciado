import React, { useEffect } from "react";

const Footer: React.FC = () => {
  // useEffect(() => {
  //   if (document.getElementById("valor-widget-script")) return;

  //   const script = document.createElement("script");
  //   script.id = "valor-widget-script";
  //   script.src = "http://localhost:3001/widget.js";
  //   script.setAttribute(
  //     "data-token",
  //     "e87a2548910308173a026ce4bbbd546e86bda120dff79012ba3d65086ed42561",
  //   );
  //   script.setAttribute("data-api", "http://localhost:3001");
  //   script.async = true;
  //   document.body.appendChild(script);

  //   return () => {
  //     document.getElementById("valor-widget-script")?.remove();
  //     document.getElementById("__fw-btn")?.remove();
  //     document.getElementById("__fw-overlay")?.remove();
  //   };
  // }, []);

  return (
    <footer className="main-footer">
      <p>Valor Corp © 2025 - 2026. Todos os direitos reservados.</p>
    </footer>
  );
};

export default Footer;
