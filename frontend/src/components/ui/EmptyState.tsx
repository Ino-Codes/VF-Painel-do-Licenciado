import React from "react";

interface EmptyStateProps {
  image: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  image,
  title,
  message,
  children,
}) => {
  return (
    <div className="empty-state-container">
      <img src={image} alt={title} className="empty-state-image" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
      <div className="empty-state-action">{children}</div>
    </div>
  );
};

export default EmptyState;
