import React, { useState, useEffect, useRef } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { TiptapMenuBar } from "../editor/TiptapEditor.tsx";
import { FiSearch, FiX } from "react-icons/fi";

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "selecionados";
}

interface InternalUser {
  id: number;
  nome: string;
  cargo?: string;
  setor?: string;
}

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  noticeToEdit?: Notice | null;
  companySlug?: string;
}

const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  noticeToEdit,
  companySlug,
}) => {
  const [sendEmail, setSendEmail] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  // Carrega lista de usuários internos uma vez
  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/api/notices/internal-users")
      .then((res) => setInternalUsers(res.data))
      .catch(() => toast.error("Erro ao carregar usuários."));
  }, [isOpen]);

  // Preenche o modal ao editar
  useEffect(() => {
    if (!editor) return;

    if (noticeToEdit) {
      editor.commands.setContent(noticeToEdit.message);
      setSendEmail(false);

      // Carrega os destinatários já selecionados
      if (noticeToEdit.id) {
        api
          .get(`/api/notices/${noticeToEdit.id}/recipients`)
          .then((res) => setSelectedUserIds(res.data))
          .catch(() => {});
      }
    } else {
      editor.commands.clearContent();
      setSelectedUserIds([]);
      setSendEmail(false);
    }
    setShowEmojiPicker(false);
    setUserSearch("");
  }, [noticeToEdit, editor, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (editor) editor.chain().focus().insertContent(emojiData.emoji).run();
    setShowEmojiPicker(false);
  };

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const selectAll = () => {
    setSelectedUserIds(filteredUsers.map((u) => u.id));
  };

  const clearAll = () => {
    setSelectedUserIds([]);
  };

  const filteredUsers = internalUsers.filter(
    (u) =>
      u.nome.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.cargo || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.setor || "").toLowerCase().includes(userSearch.toLowerCase()),
  );

  const handleSubmit = async () => {
    if (!editor || editor.isEmpty) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    const message = editor.getHTML();
    const payload = {
      message,
      sendEmail,
      company: companySlug,
      selectedUserIds, // vazio = todos; preenchido = selecionados
    };

    try {
      if (noticeToEdit) {
        await api.put(`/api/notices/${noticeToEdit.id}`, payload);
        toast.success("Aviso atualizado com sucesso!");
      } else {
        if (sendEmail) toast.loading("Postando aviso e enviando e-mails...");
        await api.post("/api/notices/", payload);
        toast.dismiss();
        toast.success("Aviso postado com sucesso!");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.dismiss();
      toast.error("Ocorreu um erro ao guardar o aviso.");
    }
  };

  const categoryConfig = [
    { category: "suggested", name: "Sugeridos" },
    { category: "smileys_people", name: "Expressões e Pessoas" },
    { category: "animals_nature", name: "Animais e Natureza" },
    { category: "food_drink", name: "Comidas e Bebidas" },
    { category: "travel_places", name: "Viagens e Lugares" },
    { category: "activities", name: "Atividades" },
    { category: "objects", name: "Objetos" },
    { category: "symbols", name: "Símbolos" },
    { category: "flags", name: "Bandeiras" },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "640px" }}>
        <h2>{noticeToEdit ? "Editar Aviso" : "Adicionar Novo Aviso"}</h2>

        {/* Editor */}
        <div className="form-row">
          <div className="tiptap-container">
            <TiptapMenuBar
              editor={editor}
              onEmojiToggle={() => setShowEmojiPicker((prev) => !prev)}
            />
            <EditorContent editor={editor} />
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="emoji-picker-container-modal"
              >
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  width="100%"
                  height={350}
                  previewConfig={{ showPreview: false }}
                  categories={categoryConfig}
                />
              </div>
            )}
          </div>
        </div>

        {/* Seletor de Destinatários */}
        <div className="form-row" style={{ marginTop: "16px" }}>
          <label>
            Visível para:
            <span
              style={{
                fontWeight: "normal",
                color: "var(--text-secondary)",
                marginLeft: "8px",
                fontSize: "13px",
              }}
            >
              {selectedUserIds.length === 0
                ? "Todos os usuários"
                : `${selectedUserIds.length} usuário(s) selecionado(s) + admins`}
            </span>
          </label>
        </div>

        {/* Barra de busca + ações */}
        <div
          className="form-row"
          style={{ display: "flex", gap: "8px", alignItems: "center" }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <FiSearch
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nome, cargo ou setor..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ paddingLeft: "32px" }}
            />
          </div>
          <button
            type="button"
            className="form-button-cancel"
            style={{ whiteSpace: "nowrap", fontSize: "13px" }}
            onClick={selectAll}
          >
            Todos
          </button>
          <button
            type="button"
            className="form-button-cancel"
            style={{ whiteSpace: "nowrap", fontSize: "13px" }}
            onClick={clearAll}
          >
            Limpar
          </button>
        </div>

        {/* Lista de usuários */}
        <div
          className="form-row"
          style={{
            maxHeight: "220px",
            overflowY: "auto",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {filteredUsers.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                padding: "20px 0",
                margin: 0,
              }}
            >
              Nenhum usuário encontrado.
            </p>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    backgroundColor: isSelected
                      ? "var(--bg-accent-color-light)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid var(--bg-accent-color)"
                      : "1px solid transparent",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: isSelected ? "600" : "400",
                        color: "var(--text-primary)",
                      }}
                    >
                      {u.nome}
                    </span>
                    {(u.cargo || u.setor) && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {[u.cargo, u.setor].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <FiX
                      size={14}
                      style={{ color: "var(--text-primary)", flexShrink: 0 }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Envio por e-mail */}
        {!noticeToEdit && (
          <div
            className="form-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "15px",
            }}
          >
            <input
              type="checkbox"
              id="sendEmail"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              style={{
                width: "auto",
                cursor: "pointer",
                transform: "scale(1.2)",
              }}
            />
            <label
              htmlFor="sendEmail"
              style={{
                cursor: "pointer",
                margin: 0,
                fontSize: "14px",
                fontWeight: "normal",
              }}
            >
              Enviar aviso por e-mail para os selecionados
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="form-button-cancel"
          >
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} className="form-button">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticeModal;
