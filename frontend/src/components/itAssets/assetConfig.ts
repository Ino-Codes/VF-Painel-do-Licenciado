import { useMemo } from "react";
import { StylesConfig } from "react-select";
import { IconType } from "react-icons";
import {
  FiPlusCircle,
  FiEdit3,
  FiUserCheck,
  FiCornerDownLeft,
  FiRepeat,
  FiTool,
  FiCheckCircle,
  FiArchive,
} from "react-icons/fi";
import { MdLaptopMac, MdSmartphone, MdDevicesOther } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext.tsx";

// ── Tipos compartilhados do Inventário de TI ─────────────────────────────

export type AssetStatus = "disponivel" | "em_uso" | "manutencao" | "baixado";
export type AssetCategoria = "computador" | "movel" | "outro";

export interface AssetType {
  id: number;
  nome: string;
  categoria: AssetCategoria;
}

export interface Asset {
  id: number;
  type_id: number;
  tipo_nome: string;
  categoria: AssetCategoria;
  patrimonio: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  admin_local: boolean | null;
  status: AssetStatus;
  user_id: number | null;
  setor_id: number | null;
  responsavel_desde: string | null;
  responsavel_nome: string | null;
  responsavel_foto: string | null;
  setor_nome: string | null;
  compartilhado: boolean;
  data_aquisicao: string | null;
  valor_aquisicao: string | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
  garantia_ate: string | null;
  observacao: string | null;
}

export interface AssetEvent {
  id: number;
  tipo: EventoTipo;
  colaborador_nome: string | null;
  setor_nome: string | null;
  detalhes: string | null;
  data_evento: string;
  feito_por_nome: string | null;
  created_at: string;
}

export interface AssetDetail extends Asset {
  eventos: AssetEvent[];
}

export type Acao =
  | "entregar"
  | "devolver"
  | "transferir"
  | "manutencao"
  | "retorno"
  | "baixa";

// ── Status ───────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  disponivel: { label: "Disponível", color: "#22c55e" },
  em_uso: { label: "Em uso", color: "#3b82f6" },
  manutencao: { label: "Em manutenção", color: "#f59e0b" },
  baixado: { label: "Baixado", color: "#94a3b8" },
};

// Ações disponíveis em cada status — espelha as transições do backend.
export const ACOES_POR_STATUS: Record<AssetStatus, Acao[]> = {
  disponivel: ["entregar", "manutencao", "baixa"],
  em_uso: ["devolver", "transferir", "manutencao", "baixa"],
  manutencao: ["retorno", "baixa"],
  baixado: [],
};

export const ACAO_CONFIG: Record<Acao, { label: string; titulo: string; Icon: IconType }> = {
  entregar: { label: "Entregar", titulo: "Entregar equipamento", Icon: FiUserCheck },
  devolver: { label: "Devolver", titulo: "Registrar devolução", Icon: FiCornerDownLeft },
  transferir: { label: "Transferir", titulo: "Transferir equipamento", Icon: FiRepeat },
  manutencao: { label: "Manutenção", titulo: "Enviar para manutenção", Icon: FiTool },
  retorno: { label: "Retorno", titulo: "Retorno da manutenção", Icon: FiCheckCircle },
  baixa: { label: "Dar baixa", titulo: "Dar baixa no equipamento", Icon: FiArchive },
};

// ── Histórico ────────────────────────────────────────────────────────────

export type EventoTipo =
  | "cadastro"
  | "edicao"
  | "entrega"
  | "devolucao"
  | "transferencia"
  | "manutencao"
  | "retorno"
  | "baixa";

export const EVENTO_CONFIG: Record<EventoTipo, { label: string; Icon: IconType }> = {
  cadastro: { label: "Cadastrado", Icon: FiPlusCircle },
  edicao: { label: "Dados editados", Icon: FiEdit3 },
  entrega: { label: "Entregue", Icon: FiUserCheck },
  devolucao: { label: "Devolvido", Icon: FiCornerDownLeft },
  transferencia: { label: "Transferido", Icon: FiRepeat },
  manutencao: { label: "Enviado para manutenção", Icon: FiTool },
  retorno: { label: "Voltou da manutenção", Icon: FiCheckCircle },
  baixa: { label: "Baixado", Icon: FiArchive },
};

// ── Tipos de ativo ───────────────────────────────────────────────────────

export const iconeDoTipo = (categoria: AssetCategoria): IconType =>
  categoria === "computador"
    ? MdLaptopMac
    : categoria === "movel"
      ? MdSmartphone
      : MdDevicesOther;

export const rotuloNumeroSerie = (categoria: AssetCategoria | undefined) =>
  categoria === "movel" ? "IMEI" : "Nº de série";

// ── Formatação ───────────────────────────────────────────────────────────

/** "2026-09-01" → "01/09/2026" (sem passar por Date, para não mudar o dia). */
export const dataBR = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

export const hojeISO = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export const nomeDoAtivo = (a: Pick<Asset, "marca" | "modelo" | "tipo_nome">) =>
  [a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo_nome;

export const moedaBR = (v: string | null) =>
  v === null
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

// ── react-select no tema do painel ───────────────────────────────────────

export interface Opcao {
  value: number;
  label: string;
}

export const useSelectStyles = () => {
  const { theme } = useTheme();
  return useMemo<StylesConfig<Opcao, false>>(() => {
    const cor = (v: string) => getComputedStyle(document.body).getPropertyValue(v).trim();
    return {
      container: (p) => ({ ...p, width: "100%", minWidth: 0 }),
      control: (p) => ({
        ...p,
        backgroundColor: cor("--bg-primary"),
        borderColor: cor("--border-color"),
        boxShadow: "none",
        minHeight: 42,
        "&:hover": { borderColor: cor("--border-strong") },
      }),
      menu: (p) => ({ ...p, backgroundColor: cor("--bg-secondary") }),
      menuPortal: (p) => ({ ...p, zIndex: 9999 }),
      option: (p, s) => ({
        ...p,
        backgroundColor: s.isFocused ? cor("--border-color") : cor("--bg-secondary"),
        color: cor("--text-primary"),
        cursor: "pointer",
      }),
      input: (p) => ({ ...p, color: cor("--text-primary") }),
      singleValue: (p) => ({ ...p, color: cor("--text-primary") }),
      placeholder: (p) => ({ ...p, color: cor("--text-secondary") }),
    };
  }, [theme]);
};
