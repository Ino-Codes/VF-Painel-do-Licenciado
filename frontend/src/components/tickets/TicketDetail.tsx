import React from "react";
import { FaBug, FaLifeRing, FaRegLightbulb } from "react-icons/fa";
import {
  FiPaperclip,
  FiInbox,
  FiClock,
  FiCheckCircle,
  FiPauseCircle,
} from "react-icons/fi";
import { IconType } from "react-icons";

// Visão do chamado para quem o abriu — a mesma na tela interna (Meus Chamados)
// e na página pública de acompanhamento. Mora aqui para as duas não saírem do
// mesmo padrão com o tempo.

export interface TicketAttachment {
  id: number;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
}

export interface PublicTicket {
  id: number;
  type: "help" | "suggestion" | "bug";
  title: string;
  status: string;
  created_at: string;
  tenant_name: string | null;
  attendant_name: string | null;
  resolution_notes: string | null;
  attachments?: TicketAttachment[];
}

export const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; Icon: IconType }
> = {
  help: { label: "Ajuda", color: "#f59e0b", Icon: FaLifeRing },
  bug: { label: "Bug", color: "#ef4444", Icon: FaBug },
  suggestion: { label: "Sugestão", color: "#6366f1", Icon: FaRegLightbulb },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  novo: { label: "Recebido", color: "#6366f1" },
  andamento: { label: "Em atendimento", color: "#f59e0b" },
  concluido: { label: "Concluído", color: "#22c55e" },
  pausado: { label: "Pausado", color: "#94a3b8" },
};

// Etapas do ciclo de vida do chamado, na ordem em que acontecem.
// "pausado" não é uma etapa: é um estado da etapa "Em atendimento".
const STATUS_FLOW: { key: string; label: string; Icon: IconType }[] = [
  { key: "novo", label: "Recebido", Icon: FiInbox },
  { key: "andamento", label: "Em atendimento", Icon: FiClock },
  { key: "concluido", label: "Concluído", Icon: FiCheckCircle },
];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR");

const getTypeInfo = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.help;
const getStatusInfo = (status: string) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.novo;

// ── Cabeçalho do chamado (identificação + status) ──────────────────────────
export const TicketHead: React.FC<{ ticket: PublicTicket }> = ({ ticket }) => {
  const typeInfo = getTypeInfo(ticket.type);
  const statusInfo = getStatusInfo(ticket.status);
  const TypeIcon = typeInfo.Icon;

  return (
    <>
      <span
        className="chamado-type"
        style={{ "--type-color": typeInfo.color } as React.CSSProperties}
      >
        <TypeIcon aria-hidden="true" />
      </span>
      <span className="chamado-detail-headings">
        <span className="chamado-detail-title">{ticket.title}</span>
        <span className="chamado-detail-meta">
          <span className="chamado-protocol">#{ticket.id}</span>
          <span>{typeInfo.label}</span>
          <span>Aberto em {formatDate(ticket.created_at)}</span>
        </span>
      </span>
      <span
        className="chamado-status"
        style={{ "--status-color": statusInfo.color } as React.CSSProperties}
      >
        {statusInfo.label}
      </span>
    </>
  );
};

// ── Corpo do chamado (timeline + campos + anexos) ──────────────────────────
export const TicketBody: React.FC<{ ticket: PublicTicket }> = ({ ticket }) => {
  const isPaused = ticket.status === "pausado";
  // Pausado fica na etapa de atendimento; status desconhecido volta ao início.
  const activeStep = isPaused
    ? 1
    : Math.max(
        0,
        STATUS_FLOW.findIndex((s) => s.key === ticket.status),
      );
  const hasAttachments = Boolean(ticket.attachments?.length);
  const showResolution =
    ticket.status === "concluido" && Boolean(ticket.resolution_notes);
  const hasFields =
    Boolean(ticket.attendant_name) ||
    Boolean(ticket.tenant_name) ||
    showResolution ||
    hasAttachments;

  return (
    <>
      <ol className="chamado-timeline" aria-label="Andamento do chamado">
        {STATUS_FLOW.map((step, index) => {
          const StepIcon = step.Icon;
          const state =
            index < activeStep
              ? "is-done"
              : index === activeStep
                ? "is-current"
                : "is-todo";
          const paused = isPaused && index === activeStep ? " is-paused" : "";
          return (
            <li
              key={step.key}
              className={`chamado-step ${state}${paused}`}
              aria-current={index === activeStep ? "step" : undefined}
            >
              <span className="chamado-step-dot">
                <StepIcon aria-hidden="true" />
              </span>
              <span className="chamado-step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {isPaused && (
        <p className="chamado-paused-note">
          <FiPauseCircle aria-hidden="true" /> O atendimento está pausado
          temporariamente.
        </p>
      )}

      {hasFields && (
        <div className="chamado-detail-body">
          {ticket.attendant_name && (
            <div className="chamado-field">
              <span className="chamado-field-label">Atendente</span>
              <p>{ticket.attendant_name}</p>
            </div>
          )}
          {ticket.tenant_name && (
            <div className="chamado-field">
              <span className="chamado-field-label">Origem</span>
              <p>{ticket.tenant_name}</p>
            </div>
          )}

          {showResolution && (
            <div className="chamado-field chamado-resolution">
              <span className="chamado-field-label">
                <FiCheckCircle aria-hidden="true" /> Resolução
              </span>
              <p>{ticket.resolution_notes}</p>
            </div>
          )}

          {hasAttachments && (
            <div className="chamado-field chamado-attach-block">
              <span className="chamado-field-label">Anexos</span>
              <ul className="chamado-attachments">
                {ticket.attachments!.map((att) => (
                  <li key={att.id}>
                    <a
                      className="chamado-attach-chip"
                      href={att.file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiPaperclip aria-hidden="true" />
                      {att.file_name || "arquivo"}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
};
