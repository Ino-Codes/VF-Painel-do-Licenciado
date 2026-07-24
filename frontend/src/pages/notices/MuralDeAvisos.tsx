// frontend/src/pages/content/MuralDeAvisos.tsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import NoticeModal from "../../components/forms/NoticeModal.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import toast from "react-hot-toast";
import { CompanySlug } from "../../types.ts";
import { FiEdit, FiTrash2 } from "react-icons/fi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "internos" | "licenciados";
  company_id: number | null;
  creator_name?: string;
}

// ─── Mapa de nomes de empresa ─────────────────────────────────────────────────

const COMPANY_NAMES: Record<CompanySlug, string> = {
  "v-tax": "V-TAX",
  "v-banking": "V-BANKING",
  "v-business": "V-BUSINESS",
  "v-corp": "V-CORP",
  "v-tech": "V-TECH",
};

// ─── Componente ───────────────────────────────────────────────────────────────

const MuralDeAvisos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Empresa vinda da URL (?company=valor-fiscal)
  const companySlug =
    (searchParams.get("company") as CompanySlug) || "v-tax";
  const companyName = COMPANY_NAMES[companySlug] || "V-TAX";

  // ─── Estado ─────────────────────────────────────────────────────────────────

  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Modal de criação/edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noticeToEdit, setNoticeToEdit] = useState<Notice | null>(null);

  // Modal de confirmação de exclusão
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  // ─── Redirect se não autenticado ────────────────────────────────────────────

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  // ─── Fetch de avisos ────────────────────────────────────────────────────────

  const fetchNotices = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get("/api/notices", {
        params: {
          company: companySlug,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        },
      });

      // O backend agora retorna { notices, totalCount, totalPages, currentPage }
      setNotices(res.data.notices);
      setTotalCount(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Erro ao buscar avisos:", err);
      toast.error("Não foi possível carregar os avisos.");
    } finally {
      setIsLoading(false);
    }
  }, [user, companySlug, currentPage]);

  useEffect(() => {
    if (user) fetchNotices();
  }, [user, fetchNotices]);

  // Reset de página ao trocar de empresa
  useEffect(() => {
    setCurrentPage(1);
  }, [companySlug]);

  // ─── Handlers de Modal ──────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setNoticeToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (notice: Notice) => {
    setNoticeToEdit(notice);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/api/notices/${itemToDelete}`);
      toast.success("Aviso excluído com sucesso!");
      // Se estava na última página com 1 item, volta uma página
      if (notices.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        fetchNotices();
      }
    } catch (err) {
      toast.error("Erro ao excluir o aviso.");
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  // ─── Formatação de data ─────────────────────────────────────────────────────

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  const canManage = user.role === "admin" || user.role === "rh";

  return (
    <div className="p-2">
      <Menu />

      <div className={`content-area document-center company-${companySlug}`}>
        {/* ── Cabeçalho ── */}
        <div className="document-header">
          <div>
            <h2 className="content-title">Mural de Avisos</h2>
            <span className="content-subtitle">{companyName}</span>
          </div>

          {canManage && (
            <button className="form-button" onClick={handleOpenCreate}>
              + Adicionar Aviso
            </button>
          )}
        </div>

        {/* ── Contador de resultados ── */}
        {!isLoading && totalCount > 0 && (
          <p className="notice-results-count">
            {totalCount} aviso{totalCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Lista de Avisos ── */}
        {isLoading ? (
          <div className="tela-loading notice-loading-box">
            Carregando avisos...
          </div>
        ) : notices.length > 0 ? (
          <div className="notice-list">
            {notices.map((notice) => (
              <div key={notice.id} className="notice-card">
                {/* Conteúdo HTML do aviso (Tiptap) */}
                <div
                  className="notice-message"
                  dangerouslySetInnerHTML={{ __html: notice.message }}
                />

                {/* Rodapé: data + ações */}
                <div className="notice-footer">
                  <small>
                    {/* NOVO: nome do autor + data */}
                    {notice.creator_name && (
                      <span className="notice-author-name">
                        {notice.creator_name}
                      </span>
                    )}
                    · {formatDate(notice.created_at)}
                  </small>

                  {canManage && (
                    <div className="notice-actions">
                      <button
                        className="list-button"
                        title="Editar aviso"
                        onClick={() => handleOpenEdit(notice)}
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="delete-button"
                        title="Excluir aviso"
                        onClick={() => handleDeleteClick(notice.id)}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            imageKey="avisos"
            title="Nenhum Aviso Publicado"
            message={`Não há avisos publicados para a ${companyName} no momento. Verifique novamente mais tarde.`}
          />
        )}

        {/* ── Paginação ── */}
        {totalPages > 1 && (
          <div className="pagination-controls">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div>
              <button
                className="list-button"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button
                className="list-button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de Criação/Edição ── */}
      {isModalOpen && (
        <NoticeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setNoticeToEdit(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setNoticeToEdit(null);
            fetchNotices();
          }}
          noticeToEdit={noticeToEdit}
          companySlug={companySlug}
        />
      )}

      {/* ── Modal de Confirmação de Exclusão ── */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita."
      />

      <Footer />
    </div>
  );
};

export default MuralDeAvisos;
