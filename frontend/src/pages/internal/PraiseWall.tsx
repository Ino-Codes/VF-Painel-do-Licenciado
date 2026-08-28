import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import PraiseModal from "../../components/forms/PraiseModal.tsx";
import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";

interface Praise {
  id: number;
  message: string;
  created_at: string;
  recipient_id: number | null;
  recipient_name: string | null;
  recipient_cargo?: string | null;
  recipient_setor?: string | null;
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

// Altura máxima (px) da mensagem antes de colapsar com "Ver mais".
const CLAMP_MAX_HEIGHT = 160;

// Mensagem do elogio com colapso: textos longos são cortados (com fade) e um
// botão "Ver mais"/"Ver menos" só aparece quando há conteúdo além do limite.
const PraiseMessage: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > CLAMP_MAX_HEIGHT + 8);
  }, [text]);

  return (
    <>
      <p
        ref={ref}
        className={`praise-card-message ${
          overflowing && !expanded ? "praise-card-message--clamped" : ""
        }`}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          className="link-button praise-readmore"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </>
  );
};

const PraiseWall: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [praises, setPraises] = useState<Praise[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [praiseToDelete, setPraiseToDelete] = useState<number | null>(null);

  const canManage = hasPermission("users.manage");

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const fetchPraises = useCallback(async (pageToLoad: number) => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/praises", {
        params: { page: pageToLoad, limit: 24 },
      });
      setPraises((prev) =>
        pageToLoad === 1 ? res.data.praises : [...prev, ...res.data.praises],
      );
      setTotalPages(res.data.totalPages);
      setPage(res.data.currentPage);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      toast.error("Não foi possível carregar os elogios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPraises(1);
  }, [user, fetchPraises]);

  const handlePublishSuccess = (created: Praise) => {
    setIsModalOpen(false);
    setPraises((prev) => [created, ...prev]);
  };

  const handleDeleteClick = (id: number) => {
    setPraiseToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (praiseToDelete === null) return;
    try {
      await api.delete(`/api/praises/${praiseToDelete}`);
      toast.success("Elogio removido.");
      setPraises((prev) => prev.filter((p) => p.id !== praiseToDelete));
    } catch (err) {
      toast.error("Erro ao remover o elogio.");
    } finally {
      setIsConfirmOpen(false);
      setPraiseToDelete(null);
    }
  };

  if (loading || !user) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">
        <div className="document-header">
          <div>
            <h2 className="content-title">Mural de Elogios</h2>
            <span className="content-subtitle">
              Reconheça publicamente um colega ou um setor. A publicação é
              anônima — só o destinatário do elogio aparece.
            </span>
          </div>

          <button
            className="form-button form-button--add"
            onClick={() => setIsModalOpen(true)}
          >
            + Publicar Elogio
          </button>
        </div>

        {loadError ? (
          <div className="tela-loading">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </div>
        ) : praises.length === 0 && !isLoading ? (
          <EmptyState
            imageKey="elogios"
            title="Nenhum elogio ainda"
            message="Seja o primeiro a reconhecer um colega ou setor! Clique em “Publicar Elogio”."
          />
        ) : (
          <>
            <div className="praise-grid">
              {praises.map((p) => (
                <article key={p.id} className="praise-card">
                  <header className="praise-card-head">
                    <div className="praise-card-recipient">
                      {p.recipient_name ? (
                        <>
                          <span className="praise-recipient-name">
                            {p.recipient_name}
                          </span>
                          {(p.recipient_cargo || p.recipient_setor) && (
                            <span className="praise-recipient-role">
                              {[p.recipient_cargo, p.recipient_setor]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="praise-recipient-name">
                            {p.recipient_setor}
                          </span>
                          <span className="praise-recipient-role">Setor</span>
                        </>
                      )}
                    </div>
                    {canManage && (
                      <button
                        className="form-icon-delete praise-delete"
                        title="Remover elogio"
                        aria-label="Remover elogio"
                        onClick={() => handleDeleteClick(p.id)}
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </header>

                  <PraiseMessage text={p.message} />

                  <footer className="praise-card-foot">
                    <span className="praise-date">
                      {formatDate(p.created_at)}
                    </span>
                  </footer>
                </article>
              ))}
            </div>

            {page < totalPages && (
              <div className="load-more-container">
                <button
                  className="list-button"
                  onClick={() => fetchPraises(page + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? "Carregando..." : "Carregar mais..."}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <PraiseModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={handlePublishSuccess}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setPraiseToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remover elogio"
        message="Tem certeza que deseja remover este elogio? Esta ação não pode ser desfeita."
      />

      <Footer />
    </div>
  );
};

export default PraiseWall;
