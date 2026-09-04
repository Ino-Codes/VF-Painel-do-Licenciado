// src/utils/assets.ts
import { IconType } from "react-icons";

// Importação dos ícones (Sugestão de pacote: HeroIcons, Phosphor ou Tabler)
import {
  PiCertificate,
  PiGraduationCap,
  PiArchive,
  PiFolderOpen,
  PiCalendarSlash,
  PiInfo,
  PiChartDonut,
  PiVideo,
  PiQuestion,
  PiChartPieSliceFill,
  PiHandHeart,
  PiHeadset,
} from "react-icons/pi";
import { TbError404 } from "react-icons/tb";

// Chaves válidas de ícone (fonte única para os consumidores, ex.: EmptyState).
export type IconKey =
  | "404"
  | "arquivos"
  | "avisos"
  | "certificado"
  | "chamados"
  | "cursos"
  | "dashs"
  | "documentos"
  | "elogios"
  | "eventos"
  | "faq"
  | "video"
  | "projetos";

// Mapeamento de chaves para Componentes de Ícone
export const iconMap: Record<IconKey, IconType> = {
  "404": TbError404,
  arquivos: PiArchive,
  avisos: PiInfo,
  certificado: PiCertificate,
  chamados: PiHeadset,
  cursos: PiGraduationCap,
  dashs: PiChartDonut,
  documentos: PiFolderOpen,
  elogios: PiHandHeart,
  eventos: PiCalendarSlash,
  faq: PiQuestion,
  video: PiVideo,
  projetos: PiChartPieSliceFill,
};

// Função simples para obter o componente
export const getIconByKey = (key: string): IconType | null => {
  return iconMap[key as IconKey] || null;
};
