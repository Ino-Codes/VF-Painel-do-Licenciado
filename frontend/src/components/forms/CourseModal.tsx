import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  visibility: "todos" | "licenciados" | "internos";
  certificate_template_url?: string;
  company_id?: number;
}

interface CourseModalProps {
  courseToEdit: Course | null;
  onClose: () => void;
  onSuccess: () => void;
}

const COMPANIES_OPTIONS = [
  { slug: "v-tax", name: "V-TAX" },
  { slug: "v-banking", name: "V-BANKING" },
  { slug: "v-business", name: "V-BUSINESS" },
  { slug: "v-corp", name: "V-CORP" },
  { slug: "v-tech", name: "V-TECH" },
];

const CourseModal: React.FC<CourseModalProps> = ({
  courseToEdit,
  onClose,
  onSuccess,
}) => {
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "v-tax";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Course["visibility"]>("todos");
  const [company, setCompany] = useState(currentCompanySlug);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  useEffect(() => {
    if (courseToEdit) {
      setTitle(courseToEdit.title);
      setDescription(courseToEdit.description);
      setVisibility(courseToEdit.visibility);
    } else {
      setTitle("");
      setDescription("");
      setVisibility("todos");
      setCompany(currentCompanySlug);
      setThumbnailFile(null);
    }
  }, [courseToEdit, currentCompanySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (courseToEdit) {
        await api.put(`/api/admin/courses/${courseToEdit.id}`, {
          title,
          description,
          visibility,
          is_active: courseToEdit.is_active,
        });

        if (thumbnailFile) {
          const formData = new FormData();
          formData.append("thumbnail", thumbnailFile);
          await api.post(
            `/api/admin/courses/${courseToEdit.id}/thumbnail`,
            formData,
          );
        }

        toast.success("Curso atualizado com sucesso!");
      } else {
        await api.post("/api/admin/courses", {
          title,
          description,
          visibility,
          company,
        });
        toast.success(
          `Curso criado na ${
            COMPANIES_OPTIONS.find((c) => c.slug === company)?.name
          }!`,
        );
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar o curso.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{courseToEdit ? "Editar Curso" : "Novo Curso"}</h2>
        <form onSubmit={handleSubmit}>
          {!courseToEdit && (
            <>
              <div className="form-row">
                <label>Empresa:</label>
              </div>
              <div className="form-row">
                <select
                  className="form-select"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  {COMPANIES_OPTIONS.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="form-row">
            <label>Dados do curso:</label>
          </div>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Título do Curso"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <textarea
              className="form-input"
              placeholder="Descrição..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Visibilidade:</label>
          </div>
          <div className="form-row">
            <select
              className="form-select"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as Course["visibility"])
              }
            >
              <option value="todos">Todos</option>
              <option value="licenciados">Apenas Licenciados</option>
              <option value="internos">Apenas Internos</option>
            </select>
          </div>

          {/* --- Upload de Thumbnail (Apenas na Edição) ---
          {courseToEdit && (
            <>
              <div className="form-row">
                <label>Alterar thumbnail:</label>
              </div>
              <div className="form-row">
                <div className="file-upload-wrapper">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files && setThumbnailFile(e.target.files[0])
                    }
                    className="file-upload-input"
                  />
                  <label htmlFor="file-upload" className="file-upload-label">
                    Escolher Arquivo
                  </label>
                  <span className="file-upload-filename">
                    {thumbnailFile
                      ? thumbnailFile.name
                      : "Nenhum arquivo escolhido"}
                  </span>
                </div>
              </div>
            </>
          )}
          */}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="form-button-cancel"
            >
              Cancelar
            </button>
            <button type="submit" className="form-button">
              {courseToEdit ? "Salvar Alterações" : "Criar Curso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseModal;
