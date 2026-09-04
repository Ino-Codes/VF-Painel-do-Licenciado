import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import Modal from "../../components/ui/Modal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import { Skeleton } from "../../components/ui/Skeleton.tsx";
import { FaBug, FaLifeRing, FaRegLightbulb } from "react-icons/fa";
import {
  FiSearch,
  FiPaperclip,
  FiAlertCircle,
  FiInbox,
  FiClock,
  FiCheckCircle,
  FiPauseCircle,
  FiChevronDown,
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

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR");

const getTypeInfo = (type: string) => TYPE_CONFIG[type] || TYPE_CONFIG.help;
const getStatusInfo = (status: string) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.novo;

// ── Cabeçalho do chamado (identificação + status) ──────────────────────────
const TicketHead: React.FC<{ ticket: PublicTicket }> = ({ ticket }) => {
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
const TicketBody: React.FC<{ ticket: PublicTicket }> = ({ ticket }) => {
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

const MeusChamados: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<PublicTicket[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── Consulta por protocolo (modal) ──
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [formId, setFormId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [searchResult, setSearchResult] = useState<PublicTicket | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/");
      return;
    }
    // Conveniência: pré-preenche a consulta com o e-mail do usuário logado.
    if (user.email) setFormEmail(user.email);
  }, [loading, user, navigate]);

  const fetchMyTickets = useCallback(async () => {
    if (!user) return;
    setIsLoadingList(true);
    try {
      const res = await api.get("/api/tickets/mine");
      setTickets(res.data);
      setListError(false);
    } catch {
      setListError(true);
    } finally {
      setIsLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchMyTickets();
  }, [user, fetchMyTickets]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formEmail.trim()) return;
    setIsSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await api.post("/api/tickets/track", {
        id: formId,
        email: formEmail,
      });
      setSearchResult(res.data);
    } catch {
      setSearchError("Chamado não encontrado. Confira o protocolo e o e-mail.");
    } finally {
      setIsSearching(false);
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchResult(null);
    setSearchError("");
    setFormId("");
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area chamados-page">
        <div className="document-header">
          <div>
            <h2 className="content-title">Meus Chamados</h2>
            <span className="content-subtitle">
              Acompanhe o andamento dos chamados abertos com o seu e-mail.
            </span>
          </div>
          <button
            className="form-button"
            onClick={() => setIsSearchOpen(true)}
          >
            <FiSearch aria-hidden="true" /> Consultar por protocolo
          </button>
        </div>

        {isLoadingList ? (
          <div className="chamado-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="chamado-skeleton">
                <Skeleton width="40px" height="40px" />
                <div className="chamado-skeleton-text">
                  <Skeleton width="60%" height="1rem" />
                  <Skeleton width="35%" height="0.75rem" />
                </div>
                <Skeleton width="110px" height="1.6rem" />
              </div>
            ))}
          </div>
        ) : listError ? (
          <div className="tela-loading">
            Não foi possível carregar os seus chamados. Tente novamente mais
            tarde.
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            imageKey="chamados"
            title="Nenhum chamado por aqui"
            message="Você ainda não abriu nenhum chamado com este e-mail. Se abriu com outro endereço, use a consulta por protocolo."
          />
        ) : (
          <div className="chamado-list">
            {tickets.map((ticket) => {
              const isOpen = expandedId === ticket.id;
              return (
                <article
                  key={ticket.id}
                  className={`chamado-detail${isOpen ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="chamado-detail-head"
                    onClick={() => setExpandedId(isOpen ? null : ticket.id)}
                    aria-expanded={isOpen}
                    aria-controls={`chamado-body-${ticket.id}`}
                  >
                    <TicketHead ticket={ticket} />
                    <FiChevronDown
                      className="chamado-chevron"
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div id={`chamado-body-${ticket.id}`}>
                      <TicketBody ticket={ticket} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isSearchOpen && (
        <Modal onClose={closeSearch} title="Consultar por protocolo">
          <div className="modal-body">
            {!searchResult ? (
              <>
                <p className="chamado-search-hint">
                  Use esta consulta para chamados abertos com outro e-mail. O
                  protocolo foi enviado a você quando o chamado foi criado.
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
                    disabled={isSearching}
                  >
                    <FiSearch aria-hidden="true" />
                    {isSearching ? "Consultando..." : "Consultar"}
                  </button>
                </form>

                {searchError && (
                  <p className="chamado-alert" role="alert">
                    <FiAlertCircle aria-hidden="true" /> {searchError}
                  </p>
                )}
              </>
            ) : (
              <div className="chamado-detail chamado-detail--in-modal">
                <div className="chamado-detail-head chamado-detail-head--static">
                  <TicketHead ticket={searchResult} />
                </div>
                <TicketBody ticket={searchResult} />
                <div className="chamado-detail-foot">
                  <button
                    className="form-button-cancel"
                    onClick={() => {
                      setSearchResult(null);
                      setFormId("");
                    }}
                  >
                    Consultar outro
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
};

export default MeusChamados;
