import React from "react";
import { useTheme } from "../../context/ThemeContext.tsx";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi";

const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="icon-button"
      title={`Mudar para tema ${theme === "light" ? "escuro" : "claro"}`}
      onMouseOver={(e) => (
        (e.currentTarget.style.transform = "scale(1.1)"),
        (e.currentTarget.style.background = "var(--bg-menu-hover)")
      )}
      onMouseOut={(e) => (
        (e.currentTarget.style.transform = "scale(1)"),
        (e.currentTarget.style.background = "var(--bg-menu)")
      )}
    >
      {theme === "light" ? <HiOutlineMoon /> : <HiOutlineSun />}
    </button>
  );
};

export default ThemeToggleButton;
