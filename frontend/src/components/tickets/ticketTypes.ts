import { IconType } from "react-icons";
import {
  FaBug,
  FaRegQuestionCircle,
  FaClipboardList,
  FaRegLightbulb,
  FaKey,
  FaLifeRing,
  FaInbox,
} from "react-icons/fa";

// Classificação do chamado. Quem escolhe é o ATENDENTE, ao iniciar o
// atendimento na Central (o solicitante só descreve o problema): antes muita
// gente marcava "bug" para ser atendida primeiro. O chamado nasce sem tipo.
//
// "help" e "suggestion" são os tipos antigos, escolhidos pelo solicitante:
// continuam aqui só para exibir o histórico.

export type TicketType =
  | "bug"
  | "duvida"
  | "solicitacao"
  | "melhoria"
  | "acesso"
  | "help"
  | "suggestion";

export interface TipoChamado {
  label: string;
  /** Ajuda o atendente a escolher. */
  descricao: string;
  color: string;
  Icon: IconType;
  /** Tipo antigo (do solicitante): não é mais oferecido. */
  legado?: boolean;
}

export const TIPOS_CHAMADO: Record<TicketType, TipoChamado> = {
  bug: {
    label: "Bug",
    descricao: "Algo que deveria funcionar e não funciona",
    color: "#ef4444",
    Icon: FaBug,
  },
  duvida: {
    label: "Dúvida",
    descricao: "Como usar, onde encontrar, orientação",
    color: "#f59e0b",
    Icon: FaRegQuestionCircle,
  },
  solicitacao: {
    label: "Solicitação",
    descricao: "Pedido de serviço: ajuste, cadastro, relatório, instalação",
    color: "#0ea5e9",
    Icon: FaClipboardList,
  },
  melhoria: {
    label: "Melhoria",
    descricao: "Algo novo ou uma mudança no que já existe",
    color: "#6366f1",
    Icon: FaRegLightbulb,
  },
  acesso: {
    label: "Acesso",
    descricao: "Senha, login, permissão ou liberação de acesso",
    color: "#14b8a6",
    Icon: FaKey,
  },
  help: {
    label: "Ajuda",
    descricao: "Tipo antigo, escolhido pelo solicitante",
    color: "#f59e0b",
    Icon: FaLifeRing,
    legado: true,
  },
  suggestion: {
    label: "Sugestão",
    descricao: "Tipo antigo, escolhido pelo solicitante",
    color: "#6366f1",
    Icon: FaRegLightbulb,
    legado: true,
  },
};

/** Tipos que o atendente pode escolher, na ordem em que aparecem. */
export const TIPOS_DO_ATENDENTE: TicketType[] = [
  "bug",
  "duvida",
  "solicitacao",
  "melhoria",
  "acesso",
];

export const TIPOS_LEGADOS: TicketType[] = ["help", "suggestion"];

/** Chamado ainda não classificado (etapa "Novo"). */
export const SEM_TIPO: TipoChamado = {
  label: "A classificar",
  descricao: "O atendente classifica ao iniciar o atendimento",
  color: "#94a3b8",
  Icon: FaInbox,
};

export const tipoInfo = (type?: string | null): TipoChamado =>
  (type && TIPOS_CHAMADO[type as TicketType]) || SEM_TIPO;
