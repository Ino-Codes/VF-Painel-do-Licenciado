import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import Modal from "../ui/Modal.tsx";

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
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
  { slug: "v-partner", name: "V-PARTNER" },
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
  const [company, setCompany] = useState(currentCompanySlug);

  useEffect(() => {
    if (courseToEdit) {
      setTitle(courseToEdit.title);
      setDescription(courseToEdit.description);
    } else {
      setTitle("");
      setDescription("");
      setCompany(currentCompanySlug);
    }
  }, [courseToEdit, currentCompanySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (courseToEdit) {
        await api.put(`/api/admin/courses/${courseToEdit.id}`, {
          title,
          description,
          is_active: courseToEdit.is_active,
        });

        toast.success("Curso atualizado com sucesso!");
      } else {
        await api.post("/api/admin/courses", {
          title,
          description,
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
    <Modal onClose={onClose} title={courseToEdit ? "Editar Curso" : "Novo Curso"}>
        <form onSubmit={handleSubmit}>
          {!courseToEdit && (
            <>
              <div className="form-row">
                <label htmlFor="course-company">Empresa:</label>
              </div>
              <div className="form-row">
                <select
                  id="course-company"
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
            <label htmlFor="course-title">Dados do curso:</label>
          </div>
          <div className="form-row">
            <input
              id="course-title"
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
              aria-label="Descrição do curso"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {courseToEdit ? "Salvar Alterações" : "Criar Curso"}
            </button>
          </div>
        </form>
    </Modal>
  );
};

export default CourseModal;
