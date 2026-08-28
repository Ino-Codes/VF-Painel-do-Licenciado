import React from "react";
import { getIconByKey, IconKey } from "../../utils/assets.ts";

interface EmptyStateProps {
  imageKey: IconKey;
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
          className="empty-state-icon"
        />
      ) : (
        // Fallback caso a chave não exista
        <div className="empty-state-fallback">-</div>
      )}

      <h3 className="empty-state-title">{title}</h3>

      <p className="empty-state-message">{message}</p>
    </div>
  );
};

export default EmptyState;
