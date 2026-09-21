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
import {
  mesAtual,
  mesCurto,
  mesTitulo,
} from "../../components/praises/praiseMonths.ts";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

interface MesComElogios {
  month: string;
  total: number;
  drafts: number;
}

const PraiseWall: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [praises, setPraises] = useState<Praise[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Competência em foco. A apuração é mensal, então a tela mostra um mês de
  // cada vez em vez de uma lista que cresce para sempre.
  const [months, setMonths] = useState<MesComElogios[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(mesAtual());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [praiseToDelete, setPraiseToDelete] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const canManage = hasPermission("praises.manage");

  const mesEmFoco = months.find((m) => m.month === selectedMonth);
  // A contagem vem do servidor (todo o mês); a lista local só tem a página
  // carregada, e contar nela subestimaria os rascunhos.
  const pendingCount =
    mesEmFoco?.drafts ?? praises.filter((p) => !p.published_at).length;
  const totalDoMes = mesEmFoco?.total ?? praises.length;

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const fetchMonths = useCallback(async (): Promise<MesComElogios[]> => {
    try {
      const res = await api.get("/api/praises/months");
      const lista = res.data as MesComElogios[];
      setMonths(lista);
      return lista;
    } catch {
      setMonths([]);
      return [];
    }
  }, []);

  const fetchPraises = useCallback(
    async (pageToLoad: number, month: string) => {
      setIsLoading(true);
      try {
        const res = await api.get("/api/praises", {
          params: { page: pageToLoad, limit: 24, month },
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
    },
    [],
  );

  // A tela abre sempre na competência ATUAL, mesmo sem elogios registrados
  // ainda: é o mês que o curador vai apurar. Os outros meses continuam a um
  // clique no seletor. Aqui só buscamos a lista de meses; a seleção inicial
  // já é o mês corrente.
  useEffect(() => {
    if (!user) return;
    fetchMonths();
  }, [user, fetchMonths]);

  useEffect(() => {
    if (user && selectedMonth) fetchPraises(1, selectedMonth);
  }, [user, selectedMonth, fetchPraises]);

  const handlePublishSuccess = async (created: Praise) => {
    setIsModalOpen(false);
    const criadoEm = created.reference_month || selectedMonth;
    await fetchMonths();
    if (criadoEm !== selectedMonth) {
      // Registrou para outro mês: leva a tela até lá, senão o elogio novo
      // simplesmente não apareceria.
      setSelectedMonth(criadoEm);
      toast.success(`Elogio registrado em ${mesTitulo(criadoEm)}.`);
    } else {
      setPraises((prev) => [created, ...prev]);
    }
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
      fetchMonths();
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
      const res = await api.post("/api/praises/publish", {
        month: selectedMonth,
      });
      const count = res.data?.published ?? 0;
      toast.success(
        count > 0
          ? `${count} elogio(s) de ${mesTitulo(selectedMonth)} publicado(s)! 🎉`
          : "Nenhum rascunho para publicar neste mês.",
      );
      await fetchMonths();
      fetchPraises(1, selectedMonth);
    } catch (err) {
      toast.error("Erro ao publicar os elogios.");
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading || !user) {
    return <LoadingSpinner />;
  }

  // O mês corrente aparece no seletor mesmo sem elogios, para o curador ter
  // onde começar a apuração do mês que acabou de virar.
  const mesesDoSeletor = months.some((m) => m.month === mesAtual())
    ? months
    : [{ month: mesAtual(), total: 0, drafts: 0 }, ...months];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">
        <div className="document-header">
          <div>
            <h2 className="content-title">Mural de Elogios</h2>
            <span className="content-subtitle">
              Apuração dos elogios da urna, mês a mês. Registre os elogios como
              rascunho e, ao final, use <strong>Publicar pendentes</strong> para
              revelar de uma vez os do mês em foco. O autor nunca é exibido,
              apenas o destinatário.
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

        <div
          className="praise-month-tabs"
          role="tablist"
          aria-label="Mês de referência"
        >
          {mesesDoSeletor.map((m) => (
            <button
              key={m.month}
              type="button"
              role="tab"
              aria-selected={m.month === selectedMonth}
              className={`praise-month-tab${
                m.month === selectedMonth ? " praise-month-tab--active" : ""
              }`}
              onClick={() => setSelectedMonth(m.month)}
            >
              <span className="praise-month-tab-label">{mesCurto(m.month)}</span>
              <span className="praise-month-tab-count">{m.total}</span>
              {m.drafts > 0 && (
                <span
                  className="praise-month-tab-dot"
                  title={`${m.drafts} rascunho(s)`}
                  aria-label={`${m.drafts} rascunho(s)`}
                />
              )}
            </button>
          ))}
        </div>

        <div className="praise-month-summary">
          <h3 className="praise-month-title">{mesTitulo(selectedMonth)}</h3>
          <span className="praise-month-meta">
            {totalDoMes} elogio{totalDoMes === 1 ? "" : "s"}
            {pendingCount > 0 && ` · ${pendingCount} em rascunho`}
          </span>
        </div>

        {loadError ? (
          <div className="tela-loading">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </div>
        ) : praises.length === 0 && !isLoading ? (
          <EmptyState
            imageKey="elogios"
            title={`Nenhum elogio em ${mesTitulo(selectedMonth).toLowerCase()}`}
            message="Os elogios apurados da urna aparecerão aqui conforme forem registrados neste mês."
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
                  onClick={() => fetchPraises(page + 1, selectedMonth)}
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
          defaultMonth={selectedMonth}
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
