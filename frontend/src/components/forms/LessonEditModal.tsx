import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import toast from "react-hot-toast";
import { Lesson } from "../../types.ts";

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-menu-bar">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive("bold") ? "is-active" : ""}
      >
        Negrito
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive("italic") ? "is-active" : ""}
      >
        Itálico
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive("bulletList") ? "is-active" : ""}
      >
        Lista Pontuada
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive("orderedList") ? "is-active" : ""}
      >
        Lista Numerada
      </button>
    </div>
  );
};

interface LessonEditModalProps {
  lesson: Partial<Lesson>;
  onClose: () => void;
  onSave: (
    lessonData: Omit<Lesson, "id" | "lesson_order" | "module_id">
  ) => Promise<void>;
}

const LessonEditModal: React.FC<LessonEditModalProps> = ({
  lesson,
  onClose,
  onSave,
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: lesson?.text_content || "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  const [title, setTitle] = React.useState(lesson?.title || "");
  const [videoUrl, setVideoUrl] = React.useState(lesson?.video_url || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("O título da aula é obrigatório.");
      return;
    }

    const htmlContent = editor.getHTML();

    await onSave({
      title: title,
      video_url: videoUrl,
      text_content: htmlContent,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{lesson.id ? "Editar Aula" : "Adicionar Nova Aula"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Título da Aula"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-row">
            <label>URL do Vídeo (Opcional):</label>
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="https://www.youtube.com/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <label>Conteúdo em Texto (Opcional):</label>
          </div>
          <div className="form-row">
            <div className="tiptap-container">
              <MenuBar editor={editor} />
              <EditorContent editor={editor} />
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
            <button type="submit" className="form-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonEditModal;
