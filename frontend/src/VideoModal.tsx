import React, { useState, useEffect } from "react";
import api from "./api.ts";
import toast from "react-hot-toast";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
}

interface VideoModalProps {
  videoToEdit: VideoData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const VideoModal: React.FC<VideoModalProps> = ({
  videoToEdit,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtube_url, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title);
      setDescription(videoToEdit.description);
      setYoutubeUrl(videoToEdit.youtube_url);
      setVisibility(videoToEdit.visibility || "public");
    }
  }, [videoToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoData = { title, description, youtube_url, visibility };
    try {
      if (videoToEdit) {
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
            <textarea
              placeholder="Descrição do vídeo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={visibility === "internal"}
                onChange={(e) =>
                  setVisibility(e.target.checked ? "internal" : "public")
                }
              />
              Visível apenas para Gestores e Admin
            </label>
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
