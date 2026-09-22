import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import Modal from "../../components/ui/Modal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import { Skeleton } from "../../components/ui/Skeleton.tsx";
import { FiSearch, FiAlertCircle, FiChevronDown } from "react-icons/fi";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import {
  PublicTicket,
  TicketHead,
  TicketBody,
} from "../../components/tickets/TicketDetail.tsx";

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
    return <LoadingSpinner />;
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
