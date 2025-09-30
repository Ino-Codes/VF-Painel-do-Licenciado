import React from "react";
import { useThemeableLogos } from "../../utils/logos.ts";

interface LogosThemeProps {
  imageKey: "faq" | "logo";
}

const LogosTheme: React.FC<LogosThemeProps> = ({ imageKey }) => {
  const imageUrl = useThemeableLogos(imageKey);

  return (
    <div className="corp-user-card-logo">
      <img
        src={imageUrl}
        alt="Logo Valor Fiscal"
        className="empty-state-image"
      />
    </div>
  );
};

export default LogosTheme;
