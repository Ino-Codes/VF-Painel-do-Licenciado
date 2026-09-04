import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { FaBug, FaLifeRing, FaRegLightbulb } from "react-icons/fa";
import {
  FiSearch,
  FiPaperclip,
  FiAlertCircle,
  FiInbox,
  FiClock,
  FiCheckCircle,
  FiPauseCircle,
  FiHeadphones,
} from "react-icons/fi";
import { IconType } from "react-icons";

interface TicketAttachment {
  id: number;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
}

interface PublicTicket {
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

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; Icon: IconType }
> = {
  help: { label: "Ajuda", color: "#f59e0b", Icon: FaLifeRing },
  bug: { label: "Bug", color: "#ef4444", Icon: FaBug },
  suggestion: { label: "Sugestão", color: "#6366f1", Icon: FaRegLightbulb },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
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

const MeusChamados: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [formId, setFormId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/");
      return;
    }
    // Conveniência: pré-preenche com o e-mail do usuário logado (editável).
    if (user.email) setFormEmail(user.email);
  }, [loading, user, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formEmail.trim()) return;
    setIsLoading(true);
    setError("");
    setTicket(null);
    try {
      const res = await api.post("/api/tickets/track", {
        id: formId,
        email: formEmail,
      });
      setTicket(res.data);
    } catch {
      setError("Chamado não encontrado. Confira o protocolo e o e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetSearch = () => {
    setTicket(null);
    setError("");
    setFormId("");
  };

  const typeInfo = ticket ? TYPE_CONFIG[ticket.type] : null;
  const statusInfo = ticket
    ? STATUS_CONFIG[ticket.status] || STATUS_CONFIG.novo
    : null;
  const TypeIcon = typeInfo?.Icon;

  const isPaused = ticket?.status === "pausado";
  // Pausado fica na etapa de atendimento; status desconhecido volta ao início.
  const activeStep = isPaused
    ? 1
    : Math.max(
        0,
        STATUS_FLOW.findIndex((s) => s.key === ticket?.status),
      );

  if (loading) return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area chamados-page">
        <div className="document-header">
          <div>
            <h2 className="content-title">Meus Chamados</h2>
            <span className="content-subtitle">
              Consulte o andamento de um chamado que você abriu.
            </span>
          </div>
        </div>

        {!ticket && (
          <section className="chamado-search-panel">
            <div className="chamado-search-icon" aria-hidden="true">
              <FiHeadphones />
            </div>
            <h3 className="chamado-search-title">Consultar andamento</h3>
            <p className="chamado-search-hint">
              Informe o número do protocolo e o e-mail usado na abertura do
              chamado. O protocolo foi enviado a você por e-mail.
            </p>

            <form className="chamado-search-form" onSubmit={handleSearch}>
              <div className="chamado-input-group chamado-input-group--id">
                <label htmlFor="chamado-protocolo">Protocolo</label>
                <input
                  id="chamado-protocolo"
                  className="form-input"
                  placeholder="Ex.: 27"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                />
              </div>
              <div className="chamado-input-group">
                <label htmlFor="chamado-email">E-mail do solicitante</label>
                <input
                  id="chamado-email"
                  className="form-input"
                  type="email"
                  placeholder="nome@vcorporate.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <button
                className="form-button chamado-search-btn"
                type="submit"
                disabled={isLoading}
              >
                <FiSearch aria-hidden="true" />
                {isLoading ? "Consultando..." : "Consultar"}
              </button>
            </form>

            {error && (
              <p className="chamado-alert" role="alert">
                <FiAlertCircle aria-hidden="true" /> {error}
              </p>
            )}
          </section>
        )}

        {ticket && typeInfo && statusInfo && (
          <article className="chamado-detail">
            <header className="chamado-detail-head">
              <span
                className="chamado-type"
                style={
                  { "--type-color": typeInfo.color } as React.CSSProperties
                }
              >
                {TypeIcon && <TypeIcon aria-hidden="true" />}
              </span>
              <div className="chamado-detail-headings">
                <h3 className="chamado-detail-title">{ticket.title}</h3>
                <p className="chamado-detail-meta">
                  <span className="chamado-protocol">#{ticket.id}</span>
                  <span>{typeInfo.label}</span>
                  <span>
                    Aberto em{" "}
                    {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </p>
              </div>
              <span
                className="chamado-status"
                style={
                  { "--status-color": statusInfo.color } as React.CSSProperties
                }
              >
                {statusInfo.label}
              </span>
            </header>

            <ol className="chamado-timeline" aria-label="Andamento do chamado">
              {STATUS_FLOW.map((step, index) => {
                const StepIcon = step.Icon;
                const state =
                  index < activeStep
                    ? "is-done"
                    : index === activeStep
                      ? "is-current"
                      : "is-todo";
                const paused =
                  isPaused && index === activeStep ? " is-paused" : "";
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

              {ticket.status === "concluido" && ticket.resolution_notes && (
                <div className="chamado-field chamado-resolution">
                  <span className="chamado-field-label">
                    <FiCheckCircle aria-hidden="true" /> Resolução
                  </span>
                  <p>{ticket.resolution_notes}</p>
                </div>
              )}

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="chamado-field chamado-attach-block">
                  <span className="chamado-field-label">Anexos</span>
                  <ul className="chamado-attachments">
                    {ticket.attachments.map((att) => (
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

            <div className="chamado-detail-foot">
              <button className="form-button-cancel" onClick={resetSearch}>
                Consultar outro chamado
              </button>
            </div>
          </article>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default MeusChamados;
