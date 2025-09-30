import { useTheme } from "../context/ThemeContext.tsx";

// 404
import MiniLogoLight from "../assets/images/minilogo.svg";
import MiniLogoDark from "../assets/images/dark_minilogo.svg";

const themeableLogos = {
  minilogo: {
    light: MiniLogoLight,
    dark: MiniLogoDark,
  },
};

export const useThemeableLogos = (assetKey: keyof typeof themeableLogos) => {
  const { theme } = useTheme(); // Obtém o tema atual ('light' or 'dark')
  return themeableLogos[assetKey][theme]; // Retorna a imagem correspondente
};
