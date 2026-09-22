import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api.ts";
import { FiSearch, FiAlertCircle } from "react-icons/fi";
import Logo from "../../img/textobranco.png";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import {
  PublicTicket,
  TicketHead,
  TicketBody,
} from "../../components/tickets/TicketDetail.tsx";

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

  return (
    <div className="track-page">
      <div className={`track-card${ticket ? " track-card--result" : ""}`}>
        <div className="track-card-header">
          <img src={Logo} alt="V-CORP" className="track-logo" />
        </div>

        <div className="track-card-body">
          <h1 className="track-title">Acompanhar chamado</h1>

          {loading && (
            <LoadingSpinner variant="inline" label="Carregando chamado" />
          )}

          {!loading && !ticket && (
            <>
              <p className="track-muted">
                Informe o número do protocolo e o e-mail usado na abertura do
                chamado.
              </p>
              <form className="chamado-search-form" onSubmit={handleManualSearch}>
                <div className="chamado-input-group chamado-input-group--id">
                  <label htmlFor="track-protocolo">Protocolo</label>
                  <input
                    id="track-protocolo"
                    className="form-input"
                    placeholder="Ex.: 27"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                  />
                </div>
                <div className="chamado-input-group">
                  <label htmlFor="track-email">E-mail do solicitante</label>
                  <input
                    id="track-email"
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
                  disabled={loading}
                >
                  <FiSearch aria-hidden="true" />
                  {loading ? "Consultando..." : "Consultar"}
                </button>
              </form>
            </>
          )}

          {error && (
            <p className="chamado-alert" role="alert">
              <FiAlertCircle aria-hidden="true" /> {error}
            </p>
          )}

          {!loading && ticket && (
            <div className="chamado-detail chamado-detail--in-modal">
              <div className="chamado-detail-head chamado-detail-head--static">
                <TicketHead ticket={ticket} />
              </div>
              <TicketBody ticket={ticket} />
              <div className="chamado-detail-foot">
                <button className="form-button-cancel" onClick={resetSearch}>
                  Consultar outro chamado
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Acompanhar;
