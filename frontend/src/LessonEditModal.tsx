import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Lesson } from "./types.ts";

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
  const [formData, setFormData] = useState({
    title: "",
    video_url: "",
    text_content: "",
  });

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || "",
        video_url: lesson.video_url || "",
        text_content: lesson.text_content || "",
      });
    }
  }, [lesson]);

  if (!lesson) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
    await onSave(formData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{lesson.id ? "Editar Aula" : "Adicionar Nova Aula"}</h2>
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
            <label>URL do Vídeo (Opcional):</label>
            <input
              type="text"
              name="video_url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={formData.video_url}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          <div className="form-row">
            <label>Conteúdo em Texto (Opcional):</label>
            <textarea
              name="text_content"
              placeholder="Escreva o conteúdo da aula aqui..."
              value={formData.text_content}
              onChange={handleChange}
              className="form-input"
              rows={8}
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
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonEditModal;
