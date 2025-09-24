import React from "react";
import { useThemeableAsset } from "../../utils/assets";

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
  const imageUrl = useThemeableAsset(imageKey);

  return (
    <div className="empty-state-container">
      <img src={imageUrl} alt={title} className="empty-state-image" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
    </div>
  );
};

export default EmptyState;
