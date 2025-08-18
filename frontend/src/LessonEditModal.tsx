import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Lesson {
  id: number;
  title: string;
  content_type: "video" | "text";
  content_data: string;
}

interface LessonEditModalProps {
  lesson: Lesson | null;
  onClose: () => void;
  onSave: (updatedLesson: Lesson) => Promise<void>;
}

const LessonEditModal: React.FC<LessonEditModalProps> = ({
  lesson,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    content_type: "video" as "video" | "text",
    content_data: "",
  });

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title,
        content_type: lesson.content_type || "video",
        content_data: lesson.content_data || "",
      });
    }
  }, [lesson]);

  if (!lesson) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("O título da aula é obrigatório.");
      return;
    }
    await onSave({ ...lesson, ...formData });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Editar Aula</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              name="title"
              placeholder="Título da Aula"
              value={formData.title}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
          <div className="form-row">
            <select
              name="content_type"
              value={formData.content_type}
              onChange={handleChange}
              className="form-select"
            >
              <option value="video">Vídeo (URL do YouTube)</option>
              <option value="text">Texto (Simples)</option>
            </select>
          </div>
          <div className="form-row">
            <textarea
              name="content_data"
              placeholder="URL do vídeo ou conteúdo de texto..."
              value={formData.content_data}
              onChange={handleChange}
              className="form-input"
              rows={5}
            />
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
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonEditModal;
