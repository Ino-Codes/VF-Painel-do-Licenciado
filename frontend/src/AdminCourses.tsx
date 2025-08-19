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
}

const AdminCourses: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  // Removemos thumbnail_url do formulário principal
  const [form, setForm] = useState({ title: "", description: "" });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Novo estado para o arquivo da thumbnail
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);

  // Proteção da rota no frontend
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      toast.error("Acesso restrito a administradores.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // Função para adicionar o header de autenticação
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
        toast.success("Dados da trilha atualizados!");
      } else {
        await api.post("/api/admin/courses", form, getAuthHeaders());
        toast.success("Trilha criada com sucesso!");
      }
      setForm({ title: "", description: "" });
      setEditingCourse(null);
      fetchCourses();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar a trilha.");
    }
  };

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

  const startEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({ title: course.title, description: course.description });
    setThumbnailFile(null);
  };

  const cancelEdit = () => {
    setEditingCourse(null);
    setForm({ title: "", description: "" });
    setThumbnailFile(null);
  };

  const handleManageContent = (courseId: number) => {
    navigate(`/admin/courses/${courseId}`);
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

  if (loading || !user || user.role !== "admin") {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>{editingCourse ? "Editar Trilha" : "Adicionar Nova Trilha"}</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Título da Trilha"
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
              {editingCourse ? "Salvar Alterações de Texto" : "Criar Trilha"}
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
        )}

        <h2>Trilhas de Conhecimento Cadastradas:</h2>
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
                    "https://via.placeholder.com/100x60.png?text=Capa"
                  }
                  alt="Thumbnail"
                  style={{ width: "100px", borderRadius: "4px" }}
                />
                <div>
                  <strong>{course.title}</strong>
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
                  className="list-button edit"
                  onClick={() => startEdit(course)}
                >
                  Editar
                </button>
                <button
                  className="list-button delete"
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
        message="Tem certeza que deseja excluir esta trilha? Todos os seus módulos e aulas também serão removidos."
      />
    </div>
  );
};

export default AdminCourses;
