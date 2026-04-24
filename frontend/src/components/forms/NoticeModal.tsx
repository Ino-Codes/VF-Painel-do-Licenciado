import React, { useState, useEffect, useRef } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { TiptapMenuBar } from "../editor/TiptapEditor.tsx";

type Visibility =
  | "todos"
  | "admin"
  | "rh"
  | "comercial"
  | "operacional"
  | "licenciado";

interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: Visibility;
}

interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  noticeToEdit?: Notice | null;
  companySlug?: string;
}

// Opções de visibilidade com labels legíveis
const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "admin", label: "Apenas Administradores" },
  { value: "rh", label: "Apenas RH" },
  { value: "comercial", label: "Apenas Comercial" },
  { value: "operacional", label: "Apenas Operacional" },
  { value: "licenciado", label: "Apenas Licenciados" },
];

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
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  useEffect(() => {
    if (noticeToEdit && editor) {
      editor.commands.setContent(noticeToEdit.message);
      setVisibility(noticeToEdit.visibility || "todos");
      setSendEmail(false);
    } else if (!noticeToEdit && editor) {
      editor.commands.clearContent();
      setVisibility("todos");
      setSendEmail(false);
    }
    setShowEmojiPicker(false);
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

  const handleSubmit = async () => {
    if (!editor || editor.isEmpty) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    const message = editor.getHTML();
    const payload = { message, visibility, sendEmail, company: companySlug };

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
      <div className="modal-content" style={{ maxWidth: "600px" }}>
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

        {/* Visibilidade */}
        <div className="form-row">
          <label htmlFor="visibility">Visível para:</label>
        </div>
        <div className="form-row">
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="form-input"
          >
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
              Enviar aviso por e-mail imediatamente
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
