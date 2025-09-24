// src/utils/assets.ts

import { useTheme } from "../context/ThemeContext.tsx";

// Importe aqui TODOS os seus assets 'light' e 'dark'
import EmptyFaqLight from "../assets/images/empty_faq.svg";
import EmptyFaqDark from "../assets/images/dark_empty_faq.svg";
// Adicione outros assets aqui (ex: empty_documentos, etc.)

// Mapeamento dos assets
const themeableAssets = {
  faq: {
    light: EmptyFaqLight,
    dark: EmptyFaqDark,
  },
  // Adicione outros assets aqui
  // documentos: {
  //   light: EmptyDocumentosLight,
  //   dark: EmptyDocumentosDark,
  // },
};

// Hook personalizado para obter o asset correto
export const useThemeableAsset = (assetKey: keyof typeof themeableAssets) => {
  const { theme } = useTheme(); // Obtém o tema atual ('light' or 'dark')
  return themeableAssets[assetKey][theme]; // Retorna a imagem correspondente
};
