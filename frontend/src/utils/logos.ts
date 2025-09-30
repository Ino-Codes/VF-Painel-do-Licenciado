import { useTheme } from "../context/ThemeContext.tsx";

// 404
import MiniLogoLight from "../assets/images/minilogo.svg";
import MiniLogoDark from "../assets/images/dark_minilogo.svg";

// Mapeamento dos assets
const themeableAssets = {
  minilogo: {
    light: MiniLogoLight,
    dark: MiniLogoDark,
  },
};

// Hook personalizado para obter o asset correto
export const useThemeableAsset = (assetKey: keyof typeof themeableAssets) => {
  const { theme } = useTheme(); // Obtém o tema atual ('light' or 'dark')
  return themeableAssets[assetKey][theme]; // Retorna a imagem correspondente
};
