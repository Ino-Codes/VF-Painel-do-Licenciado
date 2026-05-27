import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { FiClock, FiMonitor } from "react-icons/fi";
import { IoCloseSharp } from "react-icons/io5";
import {
  FaLaptopCode,
  FaCheckCircle,
  FaPauseCircle,
  FaPlayCircle,
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
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "novo", label: "Novo", color: "#6366f1" },
  { key: "andamento", label: "Em Andamento", color: "#f59e0b" },
  { key: "concluido", label: "Concluído", color: "#22c55e" },
  { key: "arquivado", label: "Arquivado", color: "#94a3b8" },
];

const TYPE_CONFIG = {
  suggestion: { label: "Sugestão", color: "#6366f1", bg: "#ede9fe" },
  bug: { label: "Bug", color: "#ef4444", bg: "#fee2e2" },
  help: { label: "Ajuda", color: "#f59e0b", bg: "#fef3c7" },
};

const ITEM_TYPE = "FEEDBACK_CARD";

// ─── Card arrastável ──────────────────────────────────────────────────────────

const TicketCard: React.FC<{
  ticket: Ticket;
  onClick: (f: Ticket) => void;
}> = ({ ticket, onClick }) => {
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id: ticket.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const ref = useRef<HTMLDivElement>(null);
  drag(ref);

  const typeInfo = TYPE_CONFIG[ticket.type] || TYPE_CONFIG.suggestion;

  const formattedDate = new Date(ticket.created_at).toLocaleDateString(
    "pt-BR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <div
      ref={ref}
      className={`ticket-card ${isDragging ? "ticket-card--dragging" : ""}`}
      onClick={() => onClick(ticket)}
    >
      {/* Linha colorida no topo */}
      <div className="ticket-card-accent" />

      {/* Header */}
      <div className="ticket-card-header">
        <span
          className="ticket-type-badge"
          style={{ color: typeInfo.color, background: typeInfo.color + "22" }}
        >
          {typeInfo.label}
        </span>
        <span className="ticket-card-id">#{ticket.id}</span>
      </div>

      {/* Título */}
      <p className="ticket-card-title">{ticket.title}</p>

      {/* Descrição */}
      {ticket.description && (
        <p className="ticket-card-desc">
          {ticket.description.length > 90
            ? ticket.description.slice(0, 90) + "..."
            : ticket.description}
        </p>
      )}

      {/* Footer */}
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

// ─── Coluna droppable ─────────────────────────────────────────────────────────

const KanbanColumn: React.FC<{
  column: { key: string; label: string; color: string };
  tickets: Ticket[];
  onDrop: (ticketId: number, newStatus: string) => void;
  onDelete: (id: number) => void;
  onCardClick: (f: Ticket) => void;
}> = ({ column, tickets, onDrop, onDelete, onCardClick }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop<{ id: number }, void, { isOver: boolean }>(
    {
      accept: ITEM_TYPE,
      drop: (item) => onDrop(item.id, column.key),
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    },
  );

  drop(ref);

  return (
    <div
      ref={ref}
      className={`kanban-column ${isOver ? "kanban-column--over" : ""}`}
    >
      <div className="kanban-column-header">
        <div className="kanban-column-header-left">
          <span
            className="kanban-column-dot"
            style={{ background: column.color }}
          />
          <span className="kanban-column-title">{column.label}</span>
        </div>
        <span className="kanban-column-count">{tickets.length}</span>
      </div>

      <div className="kanban-cards">
        {tickets.length === 0 ? (
          <div className="kanban-empty">
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

  const handleDrop = async (ticketId: number, newStatus: string) => {
    setTickets((prev) =>
      prev.map((f) => (f.id === ticketId ? { ...f, status: newStatus } : f)),
    );
    try {
      await api.patch(`/api/tickets/${ticketId}`, { status: newStatus });
    } catch {
      toast.error("Erro ao atualizar status.");
      fetchTickets();
    }
  };

  const handleStartAttending = async () => {
    if (!detailTicket) return;
    setAttending(true);
    try {
      const res = await api.patch(`/api/tickets/${detailTicket.id}/attend`);

      // Atualiza o ticket localmente com os dados retornados
      const updated: Ticket = res.data;
      setTickets((prev) =>
        prev.map((f) => (f.id === updated.id ? updated : f)),
      );
      setDetailTicket(updated);
      toast.success("Atendimento iniciado.");
    } catch {
      toast.error("Erro ao iniciar atendimento.");
    } finally {
      setAttending(false);
    }
  };

  const ticketsByStatus = (status: string) =>
    tickets.filter((f) => f.status === status);

  const isBeingAttended = detailTicket?.attendant_id != null;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <DndProvider backend={HTML5Backend}>
          <div className="page-container">
            {/* Header */}
            <div className="recruitment-header">
              <h1 className="recruitment-title">Tickets de Suporte</h1>
              <div className="recruitment-actions">
                <button
                  className="form-button"
                  onClick={() => navigate("/admin/widget-tenants")}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
            <div className="kanban-container">
              {loading ? (
                <div className="loading-state">Carregando...</div>
              ) : (
                <div className="kanban-board">
                  {COLUMNS.map((col) => (
                    <KanbanColumn
                      key={col.key}
                      column={col}
                      tickets={ticketsByStatus(col.key)}
                      onDrop={handleDrop}
                      onCardClick={setDetailTicket}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal de detalhes */}
          {detailTicket && (
            <div
              className="modal-overlay"
              onClick={() => setDetailTicket(null)}
            >
              <div
                className="detail-ticket-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="kanban-modal-left">
                  <div className="kanban-modal-header">
                    <span
                      className="ticket-type-badge"
                      style={{
                        color: TYPE_CONFIG[detailTicket.type]?.color,
                        background:
                          TYPE_CONFIG[detailTicket.type]?.color + "22",
                        fontSize: "13px",
                        padding: "4px 12px",
                      }}
                    >
                      {TYPE_CONFIG[detailTicket.type]?.label}
                    </span>

                    <button
                      className="modal-close-button"
                      onClick={() => setDetailTicket(null)}
                    >
                      <IoCloseSharp />
                    </button>
                  </div>

                  <h2 className="kanban-modal-title">{detailTicket.title}</h2>

                  {detailTicket.description && (
                    <p className="kanban-modal-desc">
                      {detailTicket.description}
                    </p>
                  )}

                  <div className="kanban-modal-footer">
                    <div className="kanban-modal-footer-left">
                      {detailTicket.name && (
                        <p className="kanban-modal-requester">
                          Solicitante: {detailTicket.name}
                        </p>
                      )}
                      <p className="kanban-modal-date">
                        Recebido em{" "}
                        {new Date(detailTicket.created_at).toLocaleString(
                          "pt-BR",
                        )}
                      </p>
                    </div>

                    <div className="kanban-modal-footer-right">
                      <p className="kanban-modal-id">
                        Ticket ID: #{detailTicket.id}
                      </p>
                      <p className="kanban-modal-system">
                        <FiMonitor size={13} /> {detailTicket.tenant_name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="kanban-modal-right">
                  {/* Atendente atual */}
                  {isBeingAttended && (
                    <div className="kanban-modal-attendant">
                      <span className="kanban-modal-attendant-label">
                        Atendente:
                      </span>
                      <span className="kanban-modal-attendant-name">
                        {detailTicket.attendant_name}
                      </span>
                    </div>
                  )}

                  {/* Campo de instruções de resolução — exibido após iniciar atendimento */}

                  {!isBeingAttended ? (
                    <button
                      className="form-button kanban-attend-btn"
                      onClick={handleStartAttending}
                      disabled={attending}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FaPlayCircle />
                      {attending ? "Iniciando..." : "Iniciar Atendimento"}
                    </button>
                  ) : (
                    <button
                      className="form-button kanban-close-btn"
                      disabled
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FaCheckCircle />
                      Encerrar Atendimento
                    </button>
                  )}

                  <div className="kanban-modal-resolution">
                    <label className="kanban-modal-resolution-label">
                      Instruções de Resolução
                    </label>
                    <textarea
                      className="kanban-modal-resolution-textarea"
                      placeholder="Descreva os passos tomados para resolver este chamado..."
                      defaultValue={detailTicket.resolution_notes || ""}
                      disabled={
                        !isBeingAttended ||
                        detailTicket.resolution_notes != null
                      }
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DndProvider>
      </div>
      <Footer />
    </div>
  );
};

export default TicketKanbanPage;
