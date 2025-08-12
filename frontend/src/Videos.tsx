import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import VideoModal from "./VideoModal.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
}

const getYoutubeEmbedUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    let videoId = urlObj.searchParams.get("v");
    if (!videoId) {
      videoId = urlObj.pathname.split("/").pop() || "";
    }
    return `https://www.youtube.com/embed/${videoId}`;
  } catch (error) {
    return "";
  }
};

const Videos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchVideos = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/videos", { params: { role: user.role } });
      setVideos(res.data);
    } catch (err) {
      toast.error("Erro ao buscar vídeos.");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const handleDeleteClick = (videoId: number) => {
    setVideoToDelete(videoId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (videoToDelete === null) return;
    try {
      await api.delete(`/api/videos/${videoToDelete}`);
      toast.success("Vídeo excluído com sucesso!");
      fetchVideos();
    } catch (err) {
      toast.error("Erro ao excluir o vídeo.");
    } finally {
      setIsConfirmModalOpen(false);
      setVideoToDelete(null);
    }
  };

  const openModalForEdit = (video: VideoData) => {
    setEditingVideo(video);
    setIsModalOpen(true);
  };

  const openModalForCreate = () => {
    setEditingVideo(null);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchVideos();
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Vídeos</h2>
          {user.role === "admin" && (
            <button className="form-button" onClick={openModalForCreate}>
              + Adicionar Vídeo
            </button>
          )}
        </div>

        <div className="video-list">
          {videos.map((video) => (
            <div key={video.id} className="video-card">
              <div className="video-embed">
                <iframe
                  src={getYoutubeEmbedUrl(video.youtube_url)}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="video-info">
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                {user.role === "admin" && (
                  <div className="video-actions">
                    <button
                      className="list-button edit"
                      onClick={() => openModalForEdit(video)}
                    >
                      Editar
                    </button>
                    <button
                      className="list-button delete"
                      onClick={() => handleDeleteClick(video.id)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {isModalOpen && (
        <VideoModal
          videoToEdit={editingVideo}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}

      <Footer />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Videos;
