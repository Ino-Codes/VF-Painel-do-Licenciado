import React from "react";

// Aciona `handler` quando o usuário pressiona Enter ou Espaço em um elemento
// não-nativo (div/li) que faz o papel de botão (role="button" + tabIndex={0}).
// Mantém o comportamento de clique acessível também pelo teclado.
export const onKeyActivate =
  (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
