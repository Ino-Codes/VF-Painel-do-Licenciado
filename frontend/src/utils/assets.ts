// src/utils/assets.ts
import { IconType } from "react-icons";

// Importação dos ícones (Sugestão de pacote: HeroIcons, Phosphor ou Tabler)
import {
  PiCertificate,
  PiGraduationCap,
  PiFolderOpen,
  PiCalendarSlash,
  PiInfo,
  PiChartDonut,
  PiVideo,
  PiQuestion,
  PiChartPieSliceFill,
} from "react-icons/pi";
import { TbError404 } from "react-icons/tb";

// Mapeamento de chaves para Componentes de Ícone
export const iconMap: Record<string, IconType> = {
  "404": TbError404,
  avisos: PiInfo,
  certificado: PiCertificate,
  cursos: PiGraduationCap,
  dashs: PiChartDonut,
  documentos: PiFolderOpen,
  eventos: PiCalendarSlash,
  faq: PiQuestion,
  video: PiVideo,
  projetos: PiChartPieSliceFill,
};

// Função simples para obter o componente
export const getIconByKey = (key: string): IconType | null => {
  return iconMap[key] || null;
};
