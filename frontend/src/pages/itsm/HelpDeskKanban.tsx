import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import {
  FiClock,
  FiMonitor,
  FiUser,
  FiSave,
  FiArchive,
  FiRotateCcw,
} from "react-icons/fi";
import { IoCloseSharp } from "react-icons/io5";
import {
  FaLaptopCode,
  FaCheckCircle,
  FaPlayCircle,
  FaBug,
  FaLifeRing,
  FaRegLightbulb,
} from "react-icons/fa";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Tenant {
  id: number;
  name: string;
}

interface Ticket {
  id: number;
  tenant_id: number;
  tenant_name: string;
  name: string;
  type: "help" | "suggestion" | "bug";
  title: string;
  description: string;
  origin_url: string;
  status: string;
  created_at: string;
  attendant_id: number | null;
  attendant_name: string | null;
  resolution_notes: string | null;
  requester_email: string | null;
  observation: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "andamento", label: "Em Andamento" },
  { key: "concluido", label: "Concluído" },
  { key: "arquivado", label: "Arquivado" },
];

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const TYPE_CONFIG = {
  suggestion: { label: "Sugestão", color: "#6366f1", bg: "#ede9fe", icon: FaRegLightbulb },
  bug: { label: "Bug", color: "#ef4444", bg: "#fee2e2", icon: FaBug },
  help: { label: "Ajuda", color: "#f59e0b", bg: "#fef3c7", icon: FaLifeRing },
};

// ─── Card ───────────────────────────────────────────────────────────────────

const TicketCard: React.FC<{
  ticket: Ticket;
  onClick: (f: Ticket) => void;
}> = ({ ticket, onClick }) => {
  const typeInfo = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.suggestion;
  const TypeIcon = typeInfo.icon;

  const formattedDate = new Date(ticket.created_at).toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <div className="ticket-card" onClick={() => onClick(ticket)}>
      <div className="ticket-card-accent" />

      <div className="ticket-card-header">
        <span
          className="ticket-type-badge"
          style={{ "--badge-color": typeInfo.color } as React.CSSProperties}
        >
          <TypeIcon className="ticket-type-icon" aria-hidden="true" />
          {typeInfo.label}
        </span>
        <span className="ticket-card-id">#{ticket.id}</span>
      </div>

      <p className="ticket-card-title">{ticket.title}</p>

      {ticket.description && (
        <p className="ticket-card-desc">
          {ticket.description.length > 90
            ? ticket.description.slice(0, 90) + "..."
            : ticket.description}
        </p>
      )}

      <div className="ticket-card-footer">
        <span className="ticket-card-requester">{ticket.name}</span>
        <span className="ticket-card-date">
          <FiClock size={11} />
          {formattedDate}
        </span>
      </div>
    </div>
  );
};

// ─── Coluna ───────────────────────────────────────────────────────────────────

const KanbanColumn: React.FC<{
  column: { key: string; label: string };
  tickets: Ticket[];
  onCardClick: (f: Ticket) => void;
}> = ({ column, tickets, onCardClick }) => {
  return (
    <div className="hd-kanban-column">
      <div className="hd-kanban-column-header">
        <div className="hd-kanban-column-header-left">
          <span className="hd-kanban-column-title">{column.label}</span>
        </div>
        <span className="hd-kanban-column-count">{tickets.length}</span>
      </div>

      <div className="hd-kanban-cards">
        {tickets.length === 0 ? (
          <div className="hd-kanban-empty">
            <span>Nenhum ticket aqui</span>
          </div>
        ) : (
          tickets.map((f) => (
            <TicketCard key={f.id} ticket={f} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const TicketKanbanPage: React.FC = () => {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [attending, setAttending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [observation, setObservation] = useState("");

  const fetchTickets = async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedTenant) params.tenant_id = selectedTenant;
      if (selectedType) params.type = selectedType;

      const res = await api.get("/api/tickets", { params });
      setTickets(res.data);
    } catch {
      toast.error("Erro ao carregar tickets.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await api.get("/api/widget-tenants");
      setTenants(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchTenants();
  }, []);
  useEffect(() => {
    fetchTickets();
  }, [selectedTenant, selectedType]);

  const openDetail = (t: Ticket) => {
    setDetailTicket(t);
    setResolutionNotes(t.resolution_notes || "");
    setObservation(t.observation || "");
  };

  // Aplica o ticket atualizado tanto no board quanto no modal aberto
  const applyUpdate = (updated: Ticket) => {
    setTickets((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setDetailTicket(updated);
  };

  // Novo → Em Andamento (registra o atendente)
  const handleStartAttending = async () => {
    if (!detailTicket) return;
    setAttending(true);
    try {
      const res = await api.patch(`/api/tickets/${detailTicket.id}/attend`);
      applyUpdate(res.data);
      toast.success("Atendimento iniciado.");
    } catch {
      toast.error("Erro ao iniciar atendimento.");
    } finally {
      setAttending(false);
    }
  };

  // Em Andamento → Concluído (envia e-mail ao solicitante)
  const handleCloseAttendance = async () => {
    if (!detailTicket) return;
    setClosing(true);
    try {
      const res = await api.patch(`/api/tickets/${detailTicket.id}/close`, {
        resolution_notes: resolutionNotes,
      });
      applyUpdate(res.data);
      toast.success("Atendimento concluído. E-mail enviado ao solicitante.");
    } catch {
      toast.error("Erro ao concluir atendimento.");
    } finally {
      setClosing(false);
    }
  };

  // Movimentações simples de status (arquivar / desarquivar)
  const changeStatus = async (newStatus: string, successMsg: string) => {
    if (!detailTicket) return;
    setMoving(true);
    try {
      const res = await api.patch(`/api/tickets/${detailTicket.id}`, {
        status: newStatus,
      });
      applyUpdate(res.data);
      toast.success(successMsg);
    } catch {
      toast.error("Erro ao mover o chamado.");
    } finally {
      setMoving(false);
    }
  };

  const handleArchive = () => changeStatus("arquivado", "Chamado arquivado.");
  const handleUnarchive = () =>
    changeStatus("andamento", "Chamado desarquivado.");

  const closeDetail = () => {
    const ticket = detailTicket;
    const obs = observation;
    setDetailTicket(null);
    // Salva a observação automaticamente se ela foi alterada
    if (ticket && obs !== (ticket.observation || "")) {
      api
        .patch(`/api/tickets/${ticket.id}`, { observation: obs })
        .then((res) => {
          const updated: Ticket = res.data;
          setTickets((prev) =>
            prev.map((f) => (f.id === updated.id ? updated : f)),
          );
        })
        .catch(() => toast.error("Erro ao salvar observação."));
    }
  };

  const ticketsByStatus = (status: string) =>
    tickets.filter((f) => f.status === status);

  const isBeingAttended = detailTicket?.attendant_id != null;
  const DetailTypeIcon = detailTicket
    ? TYPE_CONFIG[detailTicket.type]?.icon
    : null;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-container">
          {/* Header */}
          <div className="recruitment-header">
            <h1 className="recruitment-title">Tickets de Suporte</h1>
            <div className="recruitment-actions">
              <button
                className="form-button btn-icon-text"
                onClick={() => navigate("/admin/widget-tenants")}
              >
                <FaLaptopCode size={20} />
                Sistemas Integrados
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="recruitment-filters">
            <div className="filter-group">
              <select
                className="form-select"
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
              >
                <option value="">Todos os sistemas</option>
                {tenants.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <select
                className="form-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                <option value="help">Ajuda</option>
                <option value="bug">Bug</option>
                <option value="suggestion">Sugestão</option>
              </select>
            </div>
          </div>

          {/* Board */}
          <div className="hd-kanban-container">
            {loading ? (
              <div className="loading-state">Carregando...</div>
            ) : (
              <div className="hd-kanban-board">
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    column={col}
                    tickets={ticketsByStatus(col.key)}
                    onCardClick={openDetail}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal de detalhes */}
        {detailTicket && (
          <div className="modal-overlay" onClick={closeDetail}>
            <div
              className="detail-ticket-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho */}
              <div className="ticket-modal-topbar">
                <div className="ticket-modal-topbar-left">
                  <span
                    className="ticket-type-badge ticket-type-badge--lg"
                    style={
                      {
                        "--badge-color": TYPE_CONFIG[detailTicket.type]?.color,
                      } as React.CSSProperties
                    }
                  >
                    {DetailTypeIcon && (
                      <DetailTypeIcon
                        className="ticket-type-icon"
                        aria-hidden="true"
                      />
                    )}
                    {TYPE_CONFIG[detailTicket.type]?.label}
                  </span>
                  <span className="ticket-modal-id">#{detailTicket.id}</span>
                </div>
                <button
                  className="modal-close-button"
                  onClick={closeDetail}
                  aria-label="Fechar"
                >
                  <IoCloseSharp />
                </button>
              </div>

              {/* Corpo em duas colunas */}
              <div className="ticket-modal-body">
                <div className="kanban-modal-left">
                  <h2 className="kanban-modal-title">{detailTicket.title}</h2>

                  {detailTicket.description && (
                    <div className="ticket-modal-field">
                      <span className="ticket-modal-field-label">
                        Descrição
                      </span>
                      <p className="kanban-modal-desc">
                        {detailTicket.description}
                      </p>
                    </div>
                  )}

                  <div className="ticket-modal-meta">
                    {detailTicket.name && (
                      <div className="ticket-modal-meta-row">
                        <FiUser
                          className="ticket-modal-meta-icon"
                          aria-hidden="true"
                        />
                        <span className="ticket-modal-meta-label">
                          Solicitante
                        </span>
                        <span className="ticket-modal-meta-value">
                          {detailTicket.name}
                        </span>
                      </div>
                    )}
                    <div className="ticket-modal-meta-row">
                      <FiMonitor
                        className="ticket-modal-meta-icon"
                        aria-hidden="true"
                      />
                      <span className="ticket-modal-meta-label">Sistema</span>
                      <span className="ticket-modal-meta-value">
                        {detailTicket.tenant_name}
                      </span>
                    </div>
                    <div className="ticket-modal-meta-row">
                      <FiClock
                        className="ticket-modal-meta-icon"
                        aria-hidden="true"
                      />
                      <span className="ticket-modal-meta-label">Recebido</span>
                      <span className="ticket-modal-meta-value">
                        {new Date(detailTicket.created_at).toLocaleString(
                          "pt-BR",
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="kanban-modal-right">
                  {/* Atendente atual (discreto) */}
                  {isBeingAttended && detailTicket.attendant_name && (
                    <div className="ticket-modal-attendant">
                      <span className="ticket-modal-avatar">
                        {getInitials(detailTicket.attendant_name)}
                      </span>
                      <div className="ticket-modal-attendant-info">
                        <span className="ticket-modal-attendant-label">
                          Atendente
                        </span>
                        <span className="ticket-modal-attendant-name">
                          {detailTicket.attendant_name}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ações do fluxo — dependem da etapa atual do card */}
                  {detailTicket.status === "novo" && (
                    <button
                      className="ticket-modal-action-btn btn-icon-text"
                      onClick={handleStartAttending}
                      disabled={attending}
                    >
                      <FaPlayCircle />
                      {attending ? "Iniciando..." : "Iniciar atendimento"}
                    </button>
                  )}

                  {detailTicket.status === "andamento" && (
                    <div className="ticket-modal-actions">
                      <button
                        className="ticket-modal-action-btn btn-icon-text"
                        onClick={handleCloseAttendance}
                        disabled={closing || moving}
                      >
                        <FaCheckCircle />
                        {closing ? "Concluindo..." : "Concluir atendimento"}
                      </button>
                      <button
                        className="ticket-modal-action-btn ticket-modal-action-btn--secondary btn-icon-text"
                        onClick={handleArchive}
                        disabled={closing || moving}
                      >
                        <FiArchive />
                        Arquivar chamado
                      </button>
                    </div>
                  )}

                  {detailTicket.status === "concluido" && (
                    <div className="kanban-modal-concluded">
                      <FaCheckCircle />
                      Chamado concluído
                    </div>
                  )}

                  {detailTicket.status === "arquivado" && (
                    <button
                      className="ticket-modal-action-btn ticket-modal-action-btn--secondary btn-icon-text"
                      onClick={handleUnarchive}
                      disabled={moving}
                    >
                      <FiRotateCcw />
                      Desarquivar card
                    </button>
                  )}

                  {/* Instruções de resolução — editáveis durante o atendimento */}
                  {detailTicket.status !== "novo" && (
                    <div className="kanban-modal-resolution">
                      <label className="kanban-modal-resolution-label">
                        Instruções de resolução
                      </label>
                      <textarea
                        className="kanban-modal-resolution-textarea"
                        placeholder="Descreva os passos tomados para resolver este chamado."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        disabled={detailTicket.status !== "andamento"}
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Observação — salva automaticamente ao fechar */}
                  <div className="kanban-modal-resolution">
                    <div className="ticket-modal-obs-head">
                      <label className="kanban-modal-resolution-label">
                        Observação
                      </label>
                      <span className="ticket-modal-obs-hint">
                        <FiSave aria-hidden="true" />
                        salva ao sair
                      </span>
                    </div>
                    <textarea
                      className="kanban-modal-resolution-textarea"
                      placeholder="Anotações internas sobre o chamado."
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default TicketKanbanPage;
