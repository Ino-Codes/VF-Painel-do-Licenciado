// frontend/src/components/forms/NoticeModal.tsx

import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Reutilizamos os componentes de UI que você já tem
import { TiptapMenuBar, SmileyIcon } from "../../pages/Dashboard/Dashboard.tsx";

// Definimos os tipos para as props e para o objeto 'notice'
interface Notice {
  id: number;
  message: string;
  created_at: string;
  visibility: "todos" | "internos" | "licenciados";
}

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

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: { attributes: { class: "tiptap-editor" } },
  });

  // Efeito para popular o formulário quando estiver no modo de edição
  useEffect(() => {
    if (noticeToEdit && editor) {
      editor.commands.setContent(noticeToEdit.message);
      setVisibility(noticeToEdit.visibility || "todos");
    } else if (!noticeToEdit && editor) {
      editor.commands.clearContent();
      setVisibility("todos");
    }
  }, [noticeToEdit, editor, isOpen]); // Roda quando o modal abre ou a notícia a editar muda

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    if (!editor || editor.isEmpty) {
      toast.error("O aviso não pode estar em branco.");
      return;
    }

    const message = editor.getHTML();
    const payload = { message, visibility };

    try {
      if (noticeToEdit) {
        // Modo Edição
        await api.put(`/api/notices/admin/${noticeToEdit.id}`, payload);
        toast.success("Aviso atualizado com sucesso!");
      } else {
        // Modo Criação
        await api.post("/api/notices/admin", payload);
        toast.success("Aviso postado com sucesso!");
      }
      onSuccess(); // Chama a função de sucesso (para recarregar a lista)
      onClose(); // Fecha o modal
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o aviso.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{noticeToEdit ? "Editar Aviso" : "Adicionar Novo Aviso"}</h2>

        <div className="tiptap-container">
          <TiptapMenuBar editor={editor} onEmojiToggle={() => {}} />{" "}
          {/* Emoji picker pode ser adicionado depois */}
          <EditorContent editor={editor} />
        </div>

        <div className="visibility-selector" style={{ marginTop: "1rem" }}>
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
