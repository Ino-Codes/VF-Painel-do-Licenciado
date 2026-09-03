import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import PraiseModal from "../../components/forms/PraiseModal.tsx";
import PraiseCard, { Praise } from "../../components/praises/PraiseCard.tsx";
import toast from "react-hot-toast";

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
  const [isPublishing, setIsPublishing] = useState(false);

  const canManage = hasPermission("praises.manage");
  const pendingCount = praises.filter((p) => !p.published_at).length;

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

  const handlePublishAll = async () => {
    if (pendingCount === 0 || isPublishing) return;
    setIsPublishing(true);
    try {
      const res = await api.post("/api/praises/publish");
      const count = res.data?.published ?? 0;
      toast.success(
        count > 0
          ? `${count} elogio(s) publicado(s)! 🎉`
          : "Nenhum rascunho para publicar.",
      );
      // Recarrega para refletir o novo status (published_at).
      fetchPraises(1);
    } catch (err) {
      toast.error("Erro ao publicar os elogios.");
    } finally {
      setIsPublishing(false);
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
              Apuração dos elogios da urna. Registre os elogios como rascunho e,
              ao final, use <strong>Publicar pendentes</strong> para revelá-los de
              uma vez. O autor nunca é exibido, apenas o destinatário.
            </span>
          </div>

          {canManage && (
            <div className="praise-header-actions">
              {pendingCount > 0 && (
                <button
                  className="form-button"
                  onClick={handlePublishAll}
                  disabled={isPublishing}
                >
                  {isPublishing
                    ? "Publicando..."
                    : `Publicar pendentes (${pendingCount})`}
                </button>
              )}
              <button
                className="form-button form-button--add"
                onClick={() => setIsModalOpen(true)}
              >
                + Registrar Elogio
              </button>
            </div>
          )}
        </div>

        {loadError ? (
          <div className="tela-loading">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </div>
        ) : praises.length === 0 && !isLoading ? (
          <EmptyState
            imageKey="elogios"
            title="Nenhum elogio ainda"
            message="Os elogios apurados da urna aparecerão aqui conforme forem registrados."
          />
        ) : (
          <>
            <div className="praise-grid">
              {praises.map((p) => (
                <PraiseCard
                  key={p.id}
                  praise={p}
                  showStatus
                  onDelete={canManage ? handleDeleteClick : undefined}
                />
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
