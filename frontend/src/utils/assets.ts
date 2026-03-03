// src/utils/assets.ts
import { IconType } from "react-icons";

// Importação dos ícones (Sugestão de pacote: HeroIcons, Phosphor ou Tabler)
import {
  HiOutlineDocumentSearch,
  HiOutlineSpeakerphone,
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlineVideoCamera,
  HiOutlineChatAlt2,
} from "react-icons/hi";
import {
  PiCertificateThin,
  PiGraduationCapLight,
  PiFolderOpenLight,
} from "react-icons/pi";
import { TbError404 } from "react-icons/tb";

// Mapeamento de chaves para Componentes de Ícone
export const iconMap: Record<string, IconType> = {
  "404": TbError404,
  avisos: HiOutlineSpeakerphone,
  certificado: PiCertificateThin,
  cursos: PiGraduationCapLight,
  dashs: HiOutlineChartBar,
  documentos: PiFolderOpenLight,
  eventos: HiOutlineCalendar,
  faq: HiOutlineChatAlt2,
  video: HiOutlineVideoCamera,
};

// Função simples para obter o componente
export const getIconByKey = (key: string): IconType | null => {
  return iconMap[key] || null;
};
