import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { FiX, FiPlus } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

interface SocialPostModalProps {
  postToEdit?: any;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
}

const COMPANIES_OPTIONS = [
  { slug: "v-tax", name: "V-TAX" },
  { slug: "v-banking", name: "V-BANKING" },
  { slug: "v-business", name: "V-BUSINESS" },
  { slug: "v-corp", name: "V-CORP" },
  { slug: "v-tech", name: "V-TECH" },
  { slug: "v-partner", name: "V-PARTNER" },
];

const SocialPostModal: React.FC<SocialPostModalProps> = ({
  onClose,
  onSuccess,
  categories,
}) => {
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "v-tax";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [caption, setCaption] = useState("");
  const [company, setCompany] = useState(currentCompanySlug);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    setCompany(currentCompanySlug);
  }, [currentCompanySlug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const MAX_SIZE = 10 * 1024 * 1024;
      const validFiles = filesArray.filter((file) => file.size <= MAX_SIZE);
      if (validFiles.length !== filesArray.length) {
        toast.error("Alguns arquivos excedem o limite de 10MB.");
      }
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !category || selectedFiles.length === 0) {
      toast.error(
        "Preencha o título, categoria e selecione ao menos uma imagem.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("caption", caption);
    formData.append("company", company);
    selectedFiles.forEach((file) => formData.append("files", file));

    toast.loading("Fazendo upload do conteúdo...");

    try {
      await api.post("/api/social", formData);
      toast.dismiss();
      toast.success(
        `Conteúdo publicado em ${
          COMPANIES_OPTIONS.find((c) => c.slug === company)?.name || "empresa"
        } com sucesso!`,
      );
      onSuccess();
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao salvar o conteúdo para redes sociais.");
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content social-post-modal-content">
        <button type="button" className="modal-close-button" aria-label="Fechar" onClick={onClose}>
          &times;
        </button>
        <h2>Adicionar Conteúdo Social</h2>
        <form onSubmit={handleSubmit}>
          {/* Empresa */}
          <div className="form-row">
            <label>Empresa:</label>
          </div>
          <div className="form-row">
            <select
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

          {/* Título */}
          <div className="form-row">
            <label>Dados do Post:</label>
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Título (Ex: Post de Feedback)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Categoria */}
          <div className="form-row">
            <input
              type="text"
              list="social-category-suggestions"
              placeholder="Plataforma/Categoria (Instagram, LinkedIn...)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
              required
            />
            <datalist id="social-category-suggestions">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Legenda */}
          <div className="form-row">
            <textarea
              placeholder="Digite a legenda do post aqui..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="form-input social-post-modal-caption-input"
            />
          </div>

          {/* Imagens */}
          <div className="form-row social-post-modal-images">
            {previews.map((src, index) => (
              <div key={index} className="social-post-modal-preview">
                <img
                  src={src}
                  alt="preview"
                  className="social-post-modal-preview-img"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="social-post-modal-preview-remove"
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}

            <label className="file-upload-label social-post-modal-upload-box">
              <FiPlus size={24} />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="social-post-modal-file-input"
              />
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
              Publicar Conteúdo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SocialPostModal;
