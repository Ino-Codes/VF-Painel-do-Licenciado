import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  visibility: "todos" | "licenciados" | "colaboradores";
  category: string;
}

interface VideoModalProps {
  videoToEdit: VideoData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
}

const VideoModal: React.FC<VideoModalProps> = ({
  videoToEdit,
  onClose,
  onSuccess,
  categories,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtube_url, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<
    "todos" | "licenciados" | "colaboradores"
  >("todos");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title);
      setDescription(videoToEdit.description);
      setYoutubeUrl(videoToEdit.youtube_url);
      setVisibility(videoToEdit.visibility || "todos");
      setCategory(videoToEdit.category || "");
    }
  }, [videoToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !youtube_url.trim() || !category.trim()) {
      toast.error("Título, Link do YouTube e Categoria são obrigatórios.");
      return;
    }

    const videoData = { title, description, youtube_url, visibility, category };
    try {
      if (videoToEdit && videoToEdit.id) {
        await api.put(`/api/videos/${videoToEdit.id}`, videoData);
        toast.success("Vídeo atualizado com sucesso!");
      } else {
        await api.post("/api/videos", videoData);
        toast.success("Vídeo adicionado com sucesso!");
      }
      onSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o vídeo.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{videoToEdit ? "Editar Vídeo" : "Adicionar Novo Vídeo"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Título do Vídeo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="Link do YouTube (não listado)"
              value={youtube_url}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-row">
            <input
              type="text"
              list="category-suggestions"
              placeholder="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
              required
            />
            <datalist id="category-suggestions">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="form-row">
            <textarea
              placeholder="Descrição do vídeo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <label htmlFor="visibility" style={{ marginRight: "10px" }}>
              Visibilidade:
            </label>
          </div>
          <div className="form-row">
            <select
              id="visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as VideoData["visibility"])
              }
              className="form-select"
            >
              <option value="todos">Visível para Todos</option>
              <option value="licenciados">Apenas para Licenciados</option>
              <option value="colaboradores">Apenas para Colaboradores</option>
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
            <button type="submit" className="form-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoModal;
