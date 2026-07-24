import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import MeetingModal from "../../components/forms/MeetingModal.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import toast from "react-hot-toast";
import {
  FiEdit,
  FiTrash2,
  FiPaperclip,
  FiUsers,
  FiDownload,
} from "react-icons/fi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Participant {
  user_id: number;
  user_name: string;
}

interface Attachment {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
}

export interface MeetingRecord {
  id: number;
  title: string;
  description: string;
  creator_id: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  attachments: Attachment[];
}

// ─── Componente ───────────────────────────────────────────────────────────────

const MeetingRecords: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meetingToEdit, setMeetingToEdit] = useState<MeetingRecord | null>(
    null,
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchMeetings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await api.get("/api/meeting-records", {
        params: { page: currentPage, limit: ITEMS_PER_PAGE },
      });
      setMeetings(res.data.meetings);
      setTotalCount(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Não foi possível carregar as atas.");
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPage]);

  useEffect(() => {
    if (user) fetchMeetings();
  }, [user, fetchMeetings]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setMeetingToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (meeting: MeetingRecord) => {
    setMeetingToEdit(meeting);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/api/meeting-records/${itemToDelete}`);
      toast.success("Ata excluída com sucesso!");
      if (meetings.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        fetchMeetings();
      }
    } catch {
      toast.error("Erro ao excluir a ata.");
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  const canManage = user.role === "admin" || user.role === "rh";

  return (
    <div className="p-2">
      <Menu />

      <div className="content-area document-center">
        {/* ── Cabeçalho ── */}
        <div className="document-header">
          <div>
            <h2 className="content-title">Atas de Reunião</h2>
            <span className="content-subtitle">
              Registros de reuniões internas
            </span>
          </div>

          {canManage && (
            <button className="form-button" onClick={handleOpenCreate}>
              + Nova Ata
            </button>
          )}
        </div>

        {/* ── Contador ── */}
        {!isLoading && totalCount > 0 && (
          <p className="meeting-count">
            {totalCount} ata{totalCount !== 1 ? "s" : ""} registrada
            {totalCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* ── Lista ── */}
        {isLoading ? (
          <div className="tela-loading meeting-loading">
            Carregando atas...
          </div>
        ) : meetings.length > 0 ? (
          <div className="meeting-list">
            {meetings.map((meeting) => {
              const isExpanded = expandedId === meeting.id;

              return (
                <div key={meeting.id} className="meeting-card">
                  {/* ── Cabeçalho do card ── */}
                  <div
                    className="meeting-card-header"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : meeting.id)
                    }
                  >
                    <div className="meeting-card-header-left">
                      <h3 className="meeting-card-title">{meeting.title}</h3>
                      <div className="meeting-card-meta">
                        <span className="meeting-card-author">
                          {meeting.creator_name}
                        </span>
                        <span className="meeting-card-separator">·</span>
                        <span className="meeting-card-date">
                          {formatDate(meeting.created_at)}
                        </span>
                        {meeting.participants.length > 0 && (
                          <>
                            <span className="meeting-card-separator">·</span>
                            <span className="meeting-card-participants-count">
                              <FiUsers size={12} />
                              {meeting.participants.length} participante
                              {meeting.participants.length !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                        {meeting.attachments.length > 0 && (
                          <>
                            <span className="meeting-card-separator">·</span>
                            <span className="meeting-card-attachments-count">
                              <FiPaperclip size={12} />
                              {meeting.attachments.length} arquivo
                              {meeting.attachments.length !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="meeting-card-actions">
                      {canManage && (
                        <>
                          <button
                            className="list-button"
                            title="Editar ata"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(meeting);
                            }}
                          >
                            <FiEdit />
                          </button>
                          <button
                            className="delete-button"
                            title="Excluir ata"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(meeting.id);
                            }}
                          >
                            <FiTrash2 />
                          </button>
                        </>
                      )}
                      <span className="meeting-card-chevron">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* ── Conteúdo expandido ── */}
                  {isExpanded && (
                    <div className="meeting-card-body">
                      {/* Descrição */}
                      <div className="meeting-card-description">
                        <p className="meeting-card-section-label">
                          Assuntos e Decisões
                        </p>
                        <p className="meeting-card-description-text">
                          {meeting.description}
                        </p>
                      </div>

                      {/* Participantes */}
                      {meeting.participants.length > 0 && (
                        <div className="meeting-card-section">
                          <p className="meeting-card-section-label">
                            <FiUsers size={13} /> Participantes
                          </p>
                          <div className="meeting-participants-list">
                            {meeting.participants.map((p) => (
                              <span
                                key={p.user_id}
                                className="meeting-participant-chip"
                              >
                                {p.user_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Anexos */}
                      {meeting.attachments.length > 0 && (
                        <div className="meeting-card-section">
                          <p className="meeting-card-section-label">
                            <FiPaperclip size={13} /> Arquivos Anexados
                          </p>
                          <div className="meeting-attachments-list">
                            {meeting.attachments.map((a) => (
                              <a
                                key={a.id}
                                href={a.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="meeting-attachment-item"
                              >
                                <FiDownload size={13} />
                                <span>{a.file_name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            imageKey="avisos"
            title="Nenhuma Ata Registrada"
            message="Nenhuma ata de reunião foi registrada ainda."
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

      {/* ── Modais ── */}
      {isModalOpen && (
        <MeetingModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setMeetingToEdit(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setMeetingToEdit(null);
            fetchMeetings();
          }}
          meetingToEdit={meetingToEdit}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta ata? Os arquivos anexados também serão removidos. Esta ação não pode ser desfeita."
      />

      <Footer />
    </div>
  );
};

export default MeetingRecords;
