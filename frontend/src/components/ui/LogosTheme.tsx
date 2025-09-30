import React from "react";
import { useThemeableLogos } from "../../utils/logos.ts";

interface LogosThemeProps {
  imageKey: "faq" | "logo";
  title: string;
  message: string;
}

const LogosTheme: React.FC<LogosThemeProps> = ({
  imageKey,
  title,
  message,
}) => {
  const imageUrl = useThemeableLogos(imageKey);

  return (
    <div className="empty-state-container">
      <img src={imageUrl} alt={title} className="empty-state-image" />
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
    </div>
  );
};

export default LogosTheme;
