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

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{noticeToEdit ? "Editar Aviso" : "Adicionar Novo Aviso"}</h2>

        <div className="tiptap-container">
          {/* 6. Atualizar a chamada da TiptapMenuBar */}
          <TiptapMenuBar editor={editor} onEmojiToggle={toggleEmojiPicker} />
          <EditorContent editor={editor} />
        </div>

        {/* 7. Adicionar o JSX para renderizar o EmojiPicker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="emoji-picker-container-modal">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              width="100%"
              height={350}
            />
          </div>
        )}

        <div className="visibility-selector" style={{ marginTop: "1rem" }}>
          {/* (Seletor de visibilidade permanece o mesmo) */}
          <label>Enviar para:</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                name="visibilityModal"
                value="todos"
                checked={visibility === "todos"}
                onChange={() => setVisibility("todos")}
              />{" "}
              Todos
            </label>
            <label>
              <input
                type="radio"
                name="visibilityModal"
                value="internos"
                checked={visibility === "internos"}
                onChange={() => setVisibility("internos")}
              />{" "}
              Apenas Internos
            </label>
            <label>
              <input
                type="radio"
                name="visibilityModal"
                value="licenciados"
                checked={visibility === "licenciados"}
                onChange={() => setVisibility("licenciados")}
              />{" "}
              Apenas Licenciados
            </label>
          </div>
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
