import React, { useEffect, useState, useCallback } from "react";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  certificate_template_url?: string;
}

const AdminCourses: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ title: "", description: "" });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [certificateTemplateFile, setCertificateTemplateFile] =
    useState<File | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/admin/courses", getAuthHeaders());
      setCourses(res.data);
    } catch (err) {
      toast.error("Não foi possível carregar os cursos.");
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user, fetchCourses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        const updatedCourse = { ...editingCourse, ...form };
        await api.put(
          `/api/admin/courses/${editingCourse.id}`,
          updatedCourse,
          getAuthHeaders()
        );
        toast.success("Dados do curso atualizados!");
      } else {
        await api.post("/api/admin/courses", form, getAuthHeaders());
        toast.success("Curso criado com sucesso!");
      }
      setForm({ title: "", description: "" });
      setEditingCourse(null);
      fetchCourses();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o curso.");
    }
  };

  const startEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({ title: course.title, description: course.description });
    setThumbnailFile(null);
    setCertificateTemplateFile(null);
  };

  const cancelEdit = () => {
    setEditingCourse(null);
    setForm({ title: "", description: "" });
    setThumbnailFile(null);
    setCertificateTemplateFile(null);
  };

  const handleThumbnailUpload = async () => {
    if (!thumbnailFile || !editingCourse) {
      toast.error("Selecione um arquivo de imagem para fazer o upload.");
      return;
    }
    const formData = new FormData();
    formData.append("thumbnail", thumbnailFile);
    try {
      await api.post(
        `/api/admin/courses/${editingCourse.id}/thumbnail`,
        formData,
        getAuthHeaders()
      );
      toast.success("Imagem de capa atualizada com sucesso!");
      setThumbnailFile(null);
      fetchCourses();
    } catch (err) {
      toast.error("Erro ao fazer o upload da imagem.");
    }
  };

  const handleTemplateUpload = async () => {
    if (!certificateTemplateFile || !editingCourse) {
      toast.error("Selecione um arquivo de imagem para o modelo.");
      return;
    }
    const formData = new FormData();
    formData.append("template", certificateTemplateFile);
    try {
      await api.post(
        `/api/admin/courses/${editingCourse.id}/certificate-template`,
        formData,
        getAuthHeaders()
      );
      toast.success("Modelo de certificado atualizado!");
      setCertificateTemplateFile(null);
      fetchCourses();
    } catch (err) {
      toast.error("Erro ao fazer upload do modelo.");
    }
  };

  const handleManageContent = (courseId: number) =>
    navigate(`/admin/courses/${courseId}`);
  const handleDeleteClick = (id: number) => {
    setCourseToDelete(id);
    setIsConfirmModalOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (courseToDelete === null) return;
    try {
      await api.delete(
        `/api/admin/courses/${courseToDelete}`,
        getAuthHeaders()
      );
      toast.success("Curso excluído com sucesso!");
      fetchCourses();
    } catch (err) {
      toast.error("Erro ao excluir o curso.");
    } finally {
      setIsConfirmModalOpen(false);
      setCourseToDelete(null);
    }
  };

  if (loading || !user || user.role !== "admin") {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>{editingCourse ? "Editar Curso" : "Adicionar Novo Curso"}</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Título do Curso"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <textarea
              className="form-input"
              placeholder="Descrição..."
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="form-row">
            <button className="form-button" type="submit">
              {editingCourse ? "Salvar Alterações de Texto" : "Criar Curso"}
            </button>
            {editingCourse && (
              <button
                className="form-button-cancel"
                type="button"
                onClick={cancelEdit}
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>

        {editingCourse && (
          <>
            <div
              className="admin-form"
              style={{
                marginTop: "20px",
                borderTop: "2px solid #f0f0f0",
                paddingTop: "20px",
              }}
            >
              <h3>Alterar Imagem de Capa</h3>
              <div className="form-row">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files && setThumbnailFile(e.target.files[0])
                  }
                />
                <button
                  className="form-button"
                  type="button"
                  onClick={handleThumbnailUpload}
                  disabled={!thumbnailFile}
                >
                  Salvar Imagem
                </button>
              </div>
              {editingCourse.thumbnail_url && (
                <div>
                  <p>Imagem Atual:</p>
                  <img
                    src={editingCourse.thumbnail_url}
                    alt="Thumbnail atual"
                    style={{ maxWidth: "200px", borderRadius: "8px" }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <h2>Cursos Cadastrados:</h2>
        <ul className="user-list">
          {courses.map((course) => (
            <li key={course.id} className="user-list-item">
              <div
                className="user-info"
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: "15px",
                }}
              >
                <img
                  src={
                    course.thumbnail_url ||
                    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1755094868/ev4gvx4bqvz5x34ngrc8.jpg"
                  }
                  alt="Thumbnail"
                  style={{ width: "100px", borderRadius: "4px" }}
                />
                <div>
                  <strong>{course.title}</strong>
                  <br />
                  <span>{course.description}</span>
                </div>
              </div>
              <div className="user-actions">
                <button
                  className="list-button"
                  onClick={() => handleManageContent(course.id)}
                >
                  Gerenciar
                </button>
                <button
                  className="list-button"
                  onClick={() => startEdit(course)}
                >
                  Editar
                </button>
                <button
                  className="delete-button"
                  onClick={() => handleDeleteClick(course.id)}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este curso? Todos os seus módulos e aulas também serão removidos."
      />
    </div>
  );
};

export default AdminCourses;
