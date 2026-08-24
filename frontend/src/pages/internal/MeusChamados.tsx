import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { FaBug, FaLifeRing, FaRegLightbulb } from "react-icons/fa";
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

  if (loading) return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Meus Chamados</h2>
        
          <p>
            Informe o número do protocolo e o e-mail usado na abertura para
            consultar o andamento.
          </p>
        </div>

        <div className="meus-chamados-wrap">
          {!ticket && (
            <form className="chamado-search-form" onSubmit={handleSearch}>
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
              <button
                className="form-button"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Consultando..." : "Consultar"}
              </button>
            </form>
          )}

          {error && <p className="track-error">{error}</p>}

          {ticket && typeInfo && statusInfo && (
            <div className="chamado-card is-open">
              <div className="chamado-card-head chamado-card-head--static">
                <span
                  className="chamado-type"
                  style={
                    { "--type-color": typeInfo.color } as React.CSSProperties
                  }
                >
                  {TypeIcon && <TypeIcon aria-hidden="true" />}
                </span>
                <span className="chamado-main">
                  <span className="chamado-title">{ticket.title}</span>
                  <span className="chamado-sub">
                    #{ticket.id} ·{" "} Aberto em {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <span
                  className="chamado-status"
                  style={
                    {
                      "--status-color": statusInfo.color,
                    } as React.CSSProperties
                  }
                >
                  {statusInfo.label}
                </span>
              </div>

              <div className="chamado-card-body">
                <div className="chamado-field">
                  <span className="chamado-field-label">Tipo</span>
                  <p>{typeInfo.label}</p>
                </div>
                {ticket.attendant_name && (
                  <div className="chamado-field">
                    <span className="chamado-field-label">Atendente</span>
                    <p>{ticket.attendant_name}</p>
                  </div>
                )}
                {ticket.status === "concluido" && ticket.resolution_notes && (
                  <div className="chamado-field chamado-resolution">
                    <span className="chamado-field-label">
                      Instruções de resolução
                    </span>
                    <p>{ticket.resolution_notes}</p>
                  </div>
                )}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="chamado-field">
                    <span className="chamado-field-label">Anexos</span>
                    <ul className="chamado-attachments">
                      {ticket.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {att.file_name || "arquivo"}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="chamado-card-foot">
                <button
                  className="form-button-cancel"
                  onClick={resetSearch}
                >
                  Consultar outro chamado
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MeusChamados;
