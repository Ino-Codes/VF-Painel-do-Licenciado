import React, { useState, useEffect, useRef } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { FiX, FiSearch, FiPaperclip, FiTrash2 } from "react-icons/fi";
import { MeetingRecord } from "../../pages/meetings/MeetingRecords.tsx";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface InternalUser {
  id: number;
  nome: string;
  cargo?: string;
  setor?: string;
}

interface ExistingAttachment {
  id: number;
  file_name: string;
  file_url: string;
}

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  meetingToEdit?: MeetingRecord | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const MeetingModal: React.FC<MeetingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  meetingToEdit,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    ExistingAttachment[]
  >([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<number[]>(
    [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Carrega usuários ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/api/meeting-records/internal-users")
      .then((res) => setInternalUsers(res.data))
      .catch(() => toast.error("Erro ao carregar usuários."));
  }, [isOpen]);

  // ── Preenche dados ao editar ────────────────────────────────────────────────

  useEffect(() => {
    if (meetingToEdit) {
      setTitle(meetingToEdit.title);
      setDescription(meetingToEdit.description);
      setSelectedUserIds(meetingToEdit.participants.map((p) => p.user_id));
      setExistingAttachments(meetingToEdit.attachments || []);
    } else {
      setTitle("");
      setDescription("");
      setSelectedUserIds([]);
      setExistingAttachments([]);
    }
    setNewFiles([]);
    setRemovedAttachmentIds([]);
    setSendEmail(false);
    setUserSearch("");
  }, [meetingToEdit, isOpen]);

  if (!isOpen) return null;

  // ── Handlers de participantes ───────────────────────────────────────────────

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const filteredUsers = internalUsers.filter(
    (u) =>
      u.nome.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.cargo || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.setor || "").toLowerCase().includes(userSearch.toLowerCase()),
  );

  // ── Handlers de arquivos ────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setNewFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = async (
    attachmentId: number,
    meetingId: number,
  ) => {
    try {
      await api.delete(
        `/api/meeting-records/${meetingId}/attachments/${attachmentId}`,
      );
      setExistingAttachments((prev) =>
        prev.filter((a) => a.id !== attachmentId),
      );
      setRemovedAttachmentIds((prev) => [...prev, attachmentId]);
      toast.success("Anexo removido.");
    } catch {
      toast.error("Erro ao remover anexo.");
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("O título é obrigatório.");
      return;
    }
    if (!description.trim()) {
      toast.error("A descrição é obrigatória.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("participantIds", JSON.stringify(selectedUserIds));
      formData.append("sendEmail", String(sendEmail));

      newFiles.forEach((file) => {
        formData.append("attachments", file);
      });

      if (meetingToEdit) {
        await api.put(`/api/meeting-records/${meetingToEdit.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Ata atualizada com sucesso!");
      } else {
        if (sendEmail && selectedUserIds.length > 0) {
          toast.loading("Salvando ata e enviando e-mails...");
        }
        await api.post("/api/meeting-records", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.dismiss();
        toast.success("Ata registrada com sucesso!");
      }

      onSuccess();
    } catch {
      toast.dismiss();
      toast.error("Ocorreu um erro ao salvar a ata.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button type="button" className="modal-close-button" aria-label="Fechar" onClick={onClose}>
          &times;
        </button>
        <h2>
          {meetingToEdit ? "Editar Ata de Reunião" : "Nova Ata de Reunião"}
        </h2>

        {/* ── Campo A: Título ── */}
        <div className="form-row">
          <label htmlFor="meeting-title">Título da Reunião</label>
        </div>
        <div className="form-row">
          <input
            id="meeting-title"
            type="text"
            className="form-input"
            placeholder="Ex: Reunião de Planejamento Trimestral"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* ── Campo B: Descrição ── */}
        <div className="form-row">
          <label htmlFor="meeting-description">
            Assuntos Abordados e Decisões Tomadas
          </label>
        </div>
        <div className="form-row">
          <textarea
            id="meeting-description"
            className="form-input meeting-description-textarea"
            placeholder="Descreva os assuntos discutidos, decisões tomadas e próximos passos..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />
        </div>

        {/* ── Campo C: Participantes ── */}
        <div className="form-row">
          <label>
            Participantes
            <span className="text-span">
              {selectedUserIds.length === 0
                ? "Nenhum selecionado"
                : `${selectedUserIds.length} selecionado${selectedUserIds.length !== 1 ? "s" : ""}`}
            </span>
          </label>
        </div>

        <div className="form-row">
          <div className="meeting-modal-search-wrapper">
            <FiSearch size={14} className="meeting-modal-search-icon" />
            <input
              type="text"
              className="form-input meeting-modal-search-input"
              placeholder="Buscar por nome, cargo ou setor..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="form-button-cancel"
            onClick={() => setSelectedUserIds(filteredUsers.map((u) => u.id))}
          >
            Todos
          </button>
          <button
            type="button"
            className="form-button-cancel"
            onClick={() => setSelectedUserIds([])}
          >
            Limpar
          </button>
        </div>

        <div className="users-list">
          {filteredUsers.length === 0 ? (
            <p>Nenhum usuário encontrado.</p>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`users-list-option-details meeting-user-option${
                    isSelected ? " is-selected" : ""
                  }`}
                >
                  <div className="users-list-options">
                    <span>{u.nome}</span>
                    {(u.cargo || u.setor) && (
                      <span className="meeting-user-option-subtitle">
                        {[u.cargo, u.setor].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  {isSelected && <FiX />}
                </div>
              );
            })
          )}
        </div>

        {/* ── Campo D: Anexos ── */}
        <div className="form-row meeting-modal-attachments-row">
          <label>Arquivos Anexados</label>
        </div>

        {/* Anexos existentes (modo edição) */}
        {existingAttachments.length > 0 && (
          <div className="meeting-modal-attachments-existing">
            {existingAttachments.map((a) => (
              <div key={a.id} className="meeting-modal-attachment-item">
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="meeting-modal-attachment-name"
                >
                  <FiPaperclip size={13} />
                  {a.file_name}
                </a>
                {meetingToEdit && (
                  <button
                    type="button"
                    className="meeting-modal-attachment-remove"
                    onClick={() =>
                      removeExistingAttachment(a.id, meetingToEdit.id)
                    }
                  >
                    <FiTrash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Novos arquivos selecionados */}
        {newFiles.length > 0 && (
          <div className="meeting-modal-attachments-new">
            {newFiles.map((file, index) => (
              <div key={index} className="meeting-modal-attachment-item">
                <span className="meeting-modal-attachment-name">
                  <FiPaperclip size={13} />
                  {file.name}
                </span>
                <button
                  type="button"
                  className="meeting-modal-attachment-remove"
                  onClick={() => removeNewFile(index)}
                >
                  <FiTrash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="meeting-modal-file-input"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="form-button-cancel meeting-modal-attach-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FiPaperclip size={14} />
          Adicionar Arquivos
        </button>

        {/* ── Envio por e-mail ── */}
        {!meetingToEdit && (
          <div className="meeting-modal-email-row">
            <input
              type="checkbox"
              id="meeting-send-email"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <label htmlFor="meeting-send-email">
              {selectedUserIds.length > 0
                ? `Enviar ata por e-mail para o${selectedUserIds.length !== 1 ? "s" : ""} ${selectedUserIds.length} participante${selectedUserIds.length !== 1 ? "s" : ""} selecionado${selectedUserIds.length !== 1 ? "s" : ""}`
                : "Enviar ata por e-mail para os participantes"}
            </label>
          </div>
        )}

        {/* ── Ações ── */}
        <div className="modal-actions">
          <button
            type="button"
            className="form-button-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="form-button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingModal;
