import React from "react";
import { useTheme } from "../../context/ThemeContext.tsx";

const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  // Estilos inline para simplicidade, mas podem ser movidos para um CSS
  const buttonStyle: React.CSSProperties = {
    background: "var(--bg-menu-hover)",
    color: "var(--text-inverted)",
    border: "none",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <button
      onClick={toggleTheme}
      style={buttonStyle}
      title={`Mudar para tema ${theme === "light" ? "escuro" : "claro"}`}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
};

export default ThemeToggleButton;
