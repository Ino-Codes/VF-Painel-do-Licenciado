import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api.ts";
import { FaBug, FaLifeRing, FaRegLightbulb } from "react-icons/fa";
import { IconType } from "react-icons";
import Logo from "../../img/textobranco.png";

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

const Acompanhar: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formId, setFormId] = useState("");
  const [formEmail, setFormEmail] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    api
      .get(`/api/ticket/track/${token}`)
      .then((res) => setTicket(res.data))
      .catch(() => setError("Não encontramos um chamado para este link."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formEmail.trim()) return;
    setLoading(true);
    setError("");
    setTicket(null);
    try {
      const res = await api.post("/api/ticket/track", {
        id: formId,
        email: formEmail,
      });
      setTicket(res.data);
    } catch {
      setError("Chamado não encontrado. Confira o protocolo e o e-mail.");
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setTicket(null);
    setError("");
    setFormId("");
    setFormEmail("");
  };

  const typeInfo = ticket ? TYPE_CONFIG[ticket.type] : null;
  const statusInfo = ticket ? STATUS_CONFIG[ticket.status] : null;
  const TypeIcon = typeInfo?.Icon;

  return (
    <div className="track-page">
      <div className="track-card">
        <div className="track-card-header">
          <img src={Logo} alt="V-CORP" className="track-logo" />
        </div>

        <div className="track-card-body">
          <h1 className="track-title">Acompanhar chamado</h1>

          {loading && <p className="track-muted">Carregando...</p>}

          {!loading && !ticket && (
            <>
              <p className="track-muted">
                Informe o número do protocolo e o e-mail usado na abertura do
                chamado.
              </p>
              <form className="track-form" onSubmit={handleManualSearch}>
                <input
                  className="form-input"
                  placeholder="Protocolo (ex.: 27)"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                />
                <input
                  className="form-input"
                  type="email"
                  placeholder="E-mail do solicitante"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
                <button className="form-button" type="submit">
                  Consultar
                </button>
              </form>
            </>
          )}

          {error && <p className="track-error">{error}</p>}

          {!loading && ticket && typeInfo && statusInfo && (
            <div className="track-result">
              <div className="track-result-head">
                <span
                  className="track-type"
                  style={
                    { "--type-color": typeInfo.color } as React.CSSProperties
                  }
                >
                  {TypeIcon && <TypeIcon aria-hidden="true" />}
                  {typeInfo.label}
                </span>
                <span className="track-protocol">#{ticket.id}</span>
              </div>

              <h2 className="track-ticket-title">{ticket.title}</h2>

              <span
                className="track-status"
                style={
                  { "--status-color": statusInfo.color } as React.CSSProperties
                }
              >
                {statusInfo.label}
              </span>

              <p className="track-meta">
                Aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}
              </p>
              {ticket.attendant_name && (
                <p className="track-meta">
                  Atendente: {ticket.attendant_name}
                </p>
              )}

              {ticket.status === "concluido" && ticket.resolution_notes && (
                <div className="track-resolution">
                  <span className="track-resolution-label">
                    Instruções de resolução
                  </span>
                  <p>{ticket.resolution_notes}</p>
                </div>
              )}

              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="track-resolution">
                  <span className="track-resolution-label">Anexos</span>
                  <ul className="chamado-attachments">
                    {ticket.attachments.map((att) => (
                      <li key={att.id}>
                        <a href={att.file_url} target="_blank" rel="noreferrer">
                          {att.file_name || "arquivo"}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                className="form-button-cancel track-new-search"
                onClick={resetSearch}
              >
                Consultar outro chamado
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Acompanhar;
