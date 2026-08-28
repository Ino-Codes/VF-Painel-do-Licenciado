import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom"; // Importado
import Modal from "../ui/Modal.tsx";

interface VideoData {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
}

interface VideoModalProps {
  videoToEdit: VideoData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
}

// Opções de empresas
const COMPANIES_OPTIONS = [
  { slug: "v-tax", name: "V-TAX" },
  { slug: "v-banking", name: "V-BANKING" },
  { slug: "v-business", name: "V-BUSINESS" },
  { slug: "v-corp", name: "V-CORP" },
  { slug: "v-tech", name: "V-TECH" },
  { slug: "v-partner", name: "V-PARTNER" },
];

const VideoModal: React.FC<VideoModalProps> = ({
  videoToEdit,
  onClose,
  onSuccess,
  categories,
}) => {
  // 1. Captura a empresa atual da URL
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "v-tax";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtube_url, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("");

  // 2. Estado para a empresa selecionada
  const [company, setCompany] = useState(currentCompanySlug);

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title);
      setDescription(videoToEdit.description);
      setYoutubeUrl(videoToEdit.youtube_url);
      setCategory(videoToEdit.category || "");
      // Na edição, mantemos a empresa atual da navegação
      setCompany(currentCompanySlug);
    } else {
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      setCategory("");
      // Reseta para a empresa da URL
      setCompany(currentCompanySlug);
    }
  }, [videoToEdit, currentCompanySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !youtube_url.trim() || !category.trim()) {
      toast.error("Título, Link do YouTube e Categoria são obrigatórios.");
      return;
    }

    // 3. Inclui a empresa no objeto de dados
    const videoData = {
      title,
      description,
      youtube_url,
      category,
      company, // Importante para o backend salvar o ID correto
    };

    try {
      if (videoToEdit && videoToEdit.id) {
        await api.put(`/api/videos/${videoToEdit.id}`, videoData);
        toast.success("Vídeo atualizado com sucesso!");
      } else {
        await api.post("/api/videos", videoData);
        toast.success(
          `Vídeo adicionado na ${
            COMPANIES_OPTIONS.find((c) => c.slug === company)?.name
          }!`,
        );
      }
      onSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o vídeo.");
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={videoToEdit ? "Editar Vídeo" : "Adicionar Novo Vídeo"}
    >
      <form onSubmit={handleSubmit}>
          {/* 4. Campo de Seleção de Empresa */}

          <div className="form-row">
            <label htmlFor="company-select" className="content-modal-label">
              Empresa:
            </label>
          </div>
          <div className="form-row">
            <select
              id="company-select"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="form-select"
            >
              {COMPANIES_OPTIONS.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label className="content-modal-label">
              Dados do vídeo:
            </label>
          </div>
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
              placeholder="Link do YouTube"
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
    </Modal>
  );
};

export default VideoModal;
