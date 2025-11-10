import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import VideoModal from "../../components/forms/VideoModal.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  visibility: "todos" | "internos" | "licenciados";
  category: string;
}

const getYoutubeEmbedUrl = (url: string): string => {
  if (!url) return "";

  let videoId = null;

  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?#]+)/; // Parece confuso mas serve para refatorar a URL do vídeo e deixar no modelo embed correto
  const match = url.match(youtubeRegex);

  if (match && match[1]) {
    videoId = match[1];
  } else if (!url.includes("http")) {
    videoId = url;
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  return "";
};

const Videos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VideoData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Partial<VideoData> | null>(
    null
  );

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/videos/categories", {
        params: { role: user.role },
      });
      setCategories(res.data);
    } catch (err) {
      toast.error("Erro ao buscar categorias de vídeo.");
    }
  }, [user]);

  const fetchVideos = useCallback(
    async (page: number) => {
      if (!user) return;

      if (page === 1) setIsInitialLoading(true);
      if (page > 1) setIsLoadingMore(true);

      try {
        const params: any = { role: user.role, page, limit: 4 };
        if (selectedCategory) {
          params.category = selectedCategory;
        }
        const res = await api.get("/api/videos", { params });

        setVideos((prev) =>
          page === 1 ? res.data.videos : [...prev, ...res.data.videos]
        );
        setTotalPages(res.data.totalPages);
      } catch (err) {
        toast.error("Erro ao buscar vídeos.");
      } finally {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      }
    },
    [user, selectedCategory]
  );

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, fetchCategories]);

  useEffect(() => {
    if (user) {
      if (currentPage === 1) {
        setVideos([]);
      }
      fetchVideos(currentPage);
    }
  }, [user, fetchVideos, currentPage, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  const handleLoadMore = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleDeleteClick = (videoId: number) => {
    setVideoToDelete(videoId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (videoToDelete === null) return;
    try {
      await api.delete(`/api/videos/${videoToDelete}`);
      toast.success("Vídeo excluído com sucesso!");
      setCurrentPage(1);
      if (currentPage === 1) fetchVideos(1);
      fetchCategories();
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
    setCurrentPage(1);
    if (currentPage === 1) fetchVideos(1);
    fetchCategories();
  };

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">
        <div className="document-header">
          <h2>Vídeos</h2>
          {user.role === "admin" && (
            <button className="form-button" onClick={openModalForCreate}>
              + Adicionar Vídeo
            </button>
          )}
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${!selectedCategory ? "active" : ""}`}
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab-item ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {isInitialLoading ? (
          <div className="tela-loading">Carregando vídeos...</div>
        ) : (
          <>
            <div>
              {videos.length > 0 ? (
                videos.map((video) => (
                  <div className="video-list">
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
                              className="edit-button"
                              onClick={() => openModalForEdit(video)}
                            >
                              Editar
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => handleDeleteClick(video.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  imageKey="video"
                  title="Nenhum Vídeo Encontrado"
                  message="Estamos incluindo vídeos neste módulo do painel. Caso não tenha encontrado resultados para sua busca, tente novamente mais tarde."
                ></EmptyState>
              )}
            </div>

            <div className="load-more-container">
              {currentPage < totalPages && (
                <button
                  className="list-button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Carregando..." : "Carregar mais..."}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {isModalOpen && (
        <VideoModal
          videoToEdit={editingVideo}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
          categories={categories}
        />
      )}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita."
      />
      <Footer />
    </div>
  );
};

export default Videos;
