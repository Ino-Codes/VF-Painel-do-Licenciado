import React, { useState, useEffect, useRef } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { TiptapMenuBar } from "../editor/TiptapEditor.tsx";
import { FiSearch, FiX } from "react-icons/fi";

type Visibility = "todos" | "colaboradores" | "licenciados";

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: Visibility;
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
  const [visibility, setVisibility] = useState<Visibility>("todos");
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

  // Carrega usuários internos ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    api
      .get("/api/notices/internal-users")
      .then((res) => setInternalUsers(res.data))
      .catch(() => toast.error("Erro ao carregar usuários."));
  }, [isOpen]);

  // Preenche dados ao editar
  useEffect(() => {
    if (!editor) return;

    if (noticeToEdit) {
      editor.commands.setContent(noticeToEdit.message);
      setVisibility(noticeToEdit.visibility || "todos");
      setSendEmail(false);

      if (noticeToEdit.id) {
        api
          .get(`/api/notices/${noticeToEdit.id}/recipients`)
          .then((res) => setSelectedUserIds(res.data))
          .catch(() => {});
      }
    } else {
      editor.commands.clearContent();
      setVisibility("todos");
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

  const selectAll = () => setSelectedUserIds(filteredUsers.map((u) => u.id));
  const clearAll = () => setSelectedUserIds([]);

  const filteredUsers = internalUsers.filter(
    (u) =>
      u.nome.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.cargo || "").toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.setor || "").toLowerCase().includes(userSearch.toLowerCase()),
  );

  // A lista de usuários só é exibida quando visibilidade != "licenciados"
  const showUserList = visibility !== "licenciados";

  const handleSubmit = async () => {
    if (!editor || editor.isEmpty) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    const message = editor.getHTML();
    const payload = {
      message,
      visibility,
      sendEmail,
      company: companySlug,
      // Só envia selectedUserIds se a lista estiver visível
      selectedUserIds: showUserList ? selectedUserIds : [],
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
      <div className="modal-content">
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

        {/* Visibilidade macro */}
        <div className="form-row">
          <label htmlFor="visibility">Visível para:</label>
        </div>
        <div className="form-row">
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as Visibility);
              // Limpa seleção se mudar para licenciados (lista some)
              if (e.target.value === "licenciados") setSelectedUserIds([]);
            }}
            className="form-input"
          >
            <option value="todos">Todos</option>
            <option value="colaboradores">Apenas Internos</option>
            <option value="licenciados">Apenas Licenciados</option>
          </select>
        </div>

        {/* Seletor de destinatários (só aparece quando não é "licenciados") */}
        {showUserList && (
          <>
            <div className="form-row">
              <label>
                Destinatários para e-mail:
                <span className="text-span">
                  {selectedUserIds.length === 0
                    ? "Todos dentro da visibilidade selecionada"
                    : `${selectedUserIds.length} usuário(s) selecionado(s)`}
                </span>
              </label>
            </div>

            {/* Barra de busca + ações */}
            <div className="form-row">
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por nome, cargo ou setor..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="form-button-cancel"
                onClick={selectAll}
              >
                Todos
              </button>
              <button
                type="button"
                className="form-button-cancel"
                onClick={clearAll}
              >
                Limpar
              </button>
            </div>

            {/* Lista de usuários */}
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
                      className="users-list-option-details"
                      style={{
                        backgroundColor: isSelected
                          ? "var(--bg-accent-color-light)"
                          : "transparent",
                        border: isSelected
                          ? "1px solid var(--bg-accent-color)"
                          : "1px solid transparent",
                      }}
                    >
                      <div className="users-list-options">
                        <span>{u.nome}</span>
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
                      {isSelected && <FiX />}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

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
              {showUserList && selectedUserIds.length > 0
                ? `Enviar e-mail para os ${selectedUserIds.length} selecionados`
                : "Enviar aviso por e-mail para todos da visibilidade"}
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
