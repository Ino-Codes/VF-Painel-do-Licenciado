import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { FiX, FiPlus } from "react-icons/fi";
import { useSearchParams } from "react-router-dom"; // Importado para ler a URL

interface SocialPostModalProps {
  postToEdit?: any; // Para futura implementação de edição
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
}

// Configuração das empresas (Igual ao do FileModal)
const COMPANIES_OPTIONS = [
  { slug: "valor-fiscal", name: "Valor Fiscal" },
  { slug: "valor-banking", name: "Valor Banking" },
  { slug: "valor-business", name: "Valor Business" },
  { slug: "valor-corporate", name: "Valor Corp" },
];

const SocialPostModal: React.FC<SocialPostModalProps> = ({
  onClose,
  onSuccess,
  categories,
}) => {
  // Captura a empresa atual da URL
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "valor-fiscal";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [caption, setCaption] = useState("");

  // Estado para a Empresa, que inicia com a aba em que o usuário já estava
  const [company, setCompany] = useState(currentCompanySlug);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Atualiza a empresa caso a prop mude, para evitar estados fantasmas
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

    // Envia o SLUG da empresa ao invés do nome
    formData.append("company", company);

    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

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
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <h2>Adicionar Conteúdo Social</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="company-select" style={{ marginRight: "10px" }}>
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
            <input
              type="text"
              placeholder="Título do Post (Ex: Post de Feedback)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              required
            />
          </div>

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

          <div className="form-row">
            <textarea
              placeholder="Digite a legenda do post aqui..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="form-input"
              style={{
                minHeight: "120px",
                padding: "10px",
                resize: "vertical",
              }}
            />
          </div>

          <div
            className="form-row"
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "15px",
            }}
          >
            {previews.map((src, index) => (
              <div
                key={index}
                style={{ position: "relative", width: "80px", height: "80px" }}
              >
                <img
                  src={src}
                  alt="preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "5px",
                    border: "1px solid var(--border-color)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "var(--action-danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                  }}
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}

            <label
              className="file-upload-label"
              style={{
                width: "80px",
                height: "80px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--bg-primary)",
                border: "2px dashed var(--border-strong)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <FiPlus size={24} />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
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
