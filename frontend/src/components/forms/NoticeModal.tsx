import React, { useState, useEffect, useRef } from "react"; // 1. Importar o useRef
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// 1. Importar o EmojiPicker e o tipo de dado do emoji
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

import { TiptapMenuBar } from "../editor/TiptapEditor.tsx";

// Interface Notice (sem alterações)
interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "internos" | "licenciados";
}

// Interface NoticeModalProps (sem alterações)
interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  noticeToEdit?: Notice | null;
}

const NoticeModal: React.FC<NoticeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  noticeToEdit,
}) => {
  const [visibility, setVisibility] = useState<
    "todos" | "internos" | "licenciados"
  >("todos");

  // 2. Adicionar estados para controlar o Emoji Picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null); // Ref para o container do picker

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  useEffect(() => {
    if (noticeToEdit && editor) {
      editor.commands.setContent(noticeToEdit.message);
      setVisibility(noticeToEdit.visibility || "todos");
    } else if (!noticeToEdit && editor) {
      editor.commands.clearContent();
      setVisibility("todos");
    }
    // Fecha o emoji picker sempre que o modal for reaberto
    setShowEmojiPicker(false);
  }, [noticeToEdit, editor, isOpen]);

  // 3. Adicionar efeito para fechar o picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  // 4. Criar a função que insere o emoji no editor
  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (editor) {
      editor.chain().focus().insertContent(emojiData.emoji).run();
    }
    setShowEmojiPicker(false);
  };

  // 5. Criar a função que abre/fecha o picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
  };

  const handleSubmit = async () => {
    // (Lógica do handleSubmit permanece a mesma)
    if (!editor || editor.isEmpty) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }
    const message = editor.getHTML();
    const payload = { message, visibility };
    try {
      if (noticeToEdit) {
        await api.put(`/api/notices/admin/${noticeToEdit.id}`, payload);
        toast.success("Aviso atualizado com sucesso!");
      } else {
        await api.post("/api/notices/admin", payload);
        toast.success("Aviso postado com sucesso!");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o aviso.");
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

        <div className="form-row">
          <div className="tiptap-container">
            <TiptapMenuBar editor={editor} onEmojiToggle={toggleEmojiPicker} />
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

        <div className="form-row">
          <label htmlFor="visibility">Visível para:</label>
        </div>
        <div className="form-row">
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="form-input"
          >
            <option value="todos">Todos</option>
            <option value="licenciados">Apenas Licenciados</option>
            <option value="internos">Apenas Internos</option>
          </select>
        </div>
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
