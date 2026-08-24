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
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";
import { FiTrash2, FiEdit } from "react-icons/fi";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
}

const getYoutubeEmbedUrl = (url: string): string => {
  if (!url) return "";

  let videoId = null;

  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?#]+)/;
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
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<string>("all");

  const [videos, setVideos] = useState<VideoData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Partial<VideoData> | null>(
    null,
  );

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/videos/categories", {
        // Envia a empresa para filtrar categorias
        params: { role: user.role, company },
      });
      setCategories(res.data);
    } catch (err) {
      toast.error("Erro ao buscar categorias de vídeo.");
    }
  }, [user, company]);

  const fetchVideos = useCallback(
    async (page: number) => {
      if (!user) return;

      if (page === 1) setIsInitialLoading(true);
      if (page > 1) setIsLoadingMore(true);

      try {
        const params: any = {
          role: user.role,
          page,
          limit: 4,
          company, // Filtro de empresa
          _t: new Date().getTime(), // Evita cache (304)
        };

        if (selectedCategory) {
          params.category = selectedCategory;
        }

        // Headers anti-cache
        const res = await api.get("/api/videos", {
          params,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        setVideos((prev) =>
          page === 1 ? res.data.videos : [...prev, ...res.data.videos],
        );
        setTotalPages(res.data.totalPages);
      } catch (err) {
        toast.error("Erro ao buscar vídeos.");
      } finally {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      }
    },
    [user, selectedCategory, company],
  );

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, fetchCategories]); // fetchCategories depende de companySlug

  useEffect(() => {
    if (user) {
      if (currentPage === 1) {
        // Limpa lista ao trocar de filtro
        // setVideos([]); // Opcional, mas ajuda visualmente
      }
      fetchVideos(currentPage);
    }
  }, [user, fetchVideos, currentPage, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, company]); // Reseta página ao trocar de empresa

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
    fetchVideos(1); // Recarrega sempre a página 1 ao salvar
    fetchCategories();
  };

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  return (
    <div className="p-2">
      <Menu />

      <div className={`content-area document-center company-${company}`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">Vídeos</h2>
          </div>

          {hasPermission("videos.manage") && (
            <button
              className="form-button form-button--add"
              onClick={() => setIsModalOpen(true)}
            >
              + Adicionar Vídeo
            </button>
          )}
        </div>

        <CompanyFilter value={company} onChange={setCompany} />

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
            {videos.length > 0 ? (
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
                      {hasPermission("videos.manage") && (
                        <div className="video-actions">
                          <button
                            className="form-icon-edit"
                            onClick={() => openModalForEdit(video)}
                          >
                            <FiEdit />
                          </button>
                          <button
                            className="form-icon-delete"
                            onClick={() => handleDeleteClick(video.id)}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                imageKey="video"
                title="Nenhum Vídeo Encontrado"
                message="Estamos preparando conteúdos em vídeo incríveis. Fique de olho, as novidades chegam em breve!"
              ></EmptyState>
            )}

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
          videoToEdit={editingVideo as VideoData}
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
