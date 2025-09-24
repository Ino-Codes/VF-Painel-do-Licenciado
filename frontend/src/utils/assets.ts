import { useTheme } from "../context/ThemeContext.tsx";

// 404
import Empty404Light from "../assets/images/404.svg";
import Empty404Dark from "../assets/images/dark_404.svg";

// Avisos
import EmptyAvisosLight from "../assets/images/empty_avisos.svg";
import EmptyAvisosDark from "../assets/images/dark_empty_avisos.svg";

// Certificado
import EmptyCertificadoLight from "../assets/images/empty_certificado.svg";
import EmptyCertificadoDark from "../assets/images/dark_empty_certificado.svg";

// Cursos
import EmptyCursosLight from "../assets/images/empty_cursos.svg";
import EmptyCursosDark from "../assets/images/dark_empty_cursos.svg";

// Dashs (Relatórios)
import EmptyDashsLight from "../assets/images/empty_dashs.svg";
import EmptyDashsDark from "../assets/images/dark_empty_dashs.svg";

// Documentos
import EmptyDocumentosLight from "../assets/images/empty_documentos.svg";
import EmptyDocumentosDark from "../assets/images/dark_empty_documentos.svg";

// Eventos
import EmptyEventosLight from "../assets/images/empty_eventos.svg";
import EmptyEventosDark from "../assets/images/dark_empty_eventos.svg";

// FAQ
import EmptyFaqLight from "../assets/images/empty_faq.svg";
import EmptyFaqDark from "../assets/images/dark_empty_faq.svg";

// Video
import EmptyVideoLight from "../assets/images/empty_video.svg";
import EmptyVideoDark from "../assets/images/dark_empty_video.svg";

// Mapeamento dos assets
const themeableAssets = {
  404: {
    light: Empty404Light,
    dark: Empty404Dark,
  },

  avisos: {
    light: EmptyAvisosLight,
    dark: EmptyAvisosDark,
  },

  certificado: {
    light: EmptyCertificadoLight,
    dark: EmptyCertificadoDark,
  },

  cursos: {
    light: EmptyCursosLight,
    dark: EmptyCursosDark,
  },

  dashs: {
    light: EmptyDashsLight,
    dark: EmptyDashsDark,
  },

  documentos: {
    light: EmptyDocumentosLight,
    dark: EmptyDocumentosDark,
  },

  eventos: {
    light: EmptyEventosLight,
    dark: EmptyEventosDark,
  },

  faq: {
    light: EmptyFaqLight,
    dark: EmptyFaqDark,
  },

  video: {
    light: EmptyVideoLight,
    dark: EmptyVideoDark,
  },
};

// Hook personalizado para obter o asset correto
export const useThemeableAsset = (assetKey: keyof typeof themeableAssets) => {
  const { theme } = useTheme(); // Obtém o tema atual ('light' or 'dark')
  return themeableAssets[assetKey][theme]; // Retorna a imagem correspondente
};
