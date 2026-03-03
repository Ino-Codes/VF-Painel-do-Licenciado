import React from "react";
import { getIconByKey } from "../../utils/assets.ts";

interface EmptyStateProps {
  imageKey: "faq" | "logo";
  title: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  imageKey,
  title,
  message,
}) => {
  // Recupera o componente do ícone
  const IconComponent = getIconByKey(imageKey);

  return (
    <div className="empty-state-container">
      {IconComponent ? (
        <IconComponent
          size={120} // Tamanho grande para substituir a imagem
          className="icon"
        />
      ) : (
        // Fallback caso a chave não exista
        <div style={{ height: 120, marginBottom: 20 }}>-</div>
      )}

      <h3>{title}</h3>

      <p>{message}</p>
    </div>
  );
};

export default EmptyState;
