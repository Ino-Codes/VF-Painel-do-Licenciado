import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import api from './api.ts';
import Menu from './Menu.tsx';
import Footer from './Footer.tsx';
import VideoModal from './VideoModal.tsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
}

// Função para converter URL do YouTube em URL de embed
const getYoutubeEmbedUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    let videoId = urlObj.searchParams.get('v');
    if (!videoId) {
      videoId = urlObj.pathname.split('/').pop() || '';
    }
    return `https://www.youtube.com/embed/${videoId}`;
  } catch (error) {
    return ''; // Retorna vazio se a URL for inválida
  }
};

const Videoteca: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const fetchVideos = async () => {
    try {
      const res = await api.get('/api/videos');
      setVideos(res.data);
    } catch (err) {
      toast.error('Erro ao buscar vídeos.');
    }
  };

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const handleDelete = async (videoId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este vídeo?')) {
      try {
        await api.delete(`/api/videos/${videoId}`);
        toast.success('Vídeo excluído com sucesso!');
        fetchVideos();
      } catch (err) {
        toast.error('Erro ao excluir o vídeo.');
      }
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
          <h2>Videoteca</h2>
          {user.role === 'admin' && (
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
                {user.role === 'admin' && (
                  <div className="video-actions">
                    <button className="list-button edit" onClick={() => openModalForEdit(video)}>Editar</button>
                    <button className="list-button delete" onClick={() => handleDelete(video.id)}>Excluir</button>
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
    </div>
  );
};

export default Videoteca;