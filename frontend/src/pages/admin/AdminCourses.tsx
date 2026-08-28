import React, { useEffect, useState, useCallback } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import CourseModal from "../../components/forms/CourseModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import { FiTrash2, FiEdit } from "react-icons/fi";
import { FaChalkboardTeacher } from "react-icons/fa";
// Removemos import de CompanySlug pois não filtraremos mais aqui

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  is_active: boolean;
  certificate_template_url?: string;
  company_name?: string; // Campo novo vindo do backend
}

const AdminCourses: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Não lemos mais a URL para filtro

  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    try {
      // Removemos o params: { company: ... }
      const res = await api.get("/api/admin/courses", {
        params: {
          _t: new Date().getTime(), // Evita cache
        },
      });
      setCourses(res.data);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      toast.error("Não foi possível carregar os cursos.");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user, fetchCourses]);

  const openModalForCreate = () => {
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  const openModalForEdit = (course: Course) => {
    setEditingCourse(course);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchCourses();
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
      await api.delete(`/api/admin/courses/${courseToDelete}`);
      toast.success("Curso excluído com sucesso!");
      fetchCourses();
    } catch (err) {
      toast.error("Erro ao excluir o curso.");
    } finally {
      setIsConfirmModalOpen(false);
      setCourseToDelete(null);
    }
  };

  // Função auxiliar para cor da badge da empresa
  const getCompanyColor = (name: string | undefined) => {
    if (!name) return "var(--action-secondary)";
    if (name.includes("TAX") || name === "V-TAX") return "var(--v-tax)";
    if (name.includes("BANKING") || name === "V-BANKING")
      return "var(--v-banking)";
    if (name.includes("BUSINESS") || name === "V-BUSINESS")
      return "var(--v-business)";
    if (name.includes("CORP") || name === "V-CORP") return "var(--v-corp)";
    if (name.includes("TECH") || name === "V-TECH") return "var(--v-tech)";
    if (name.includes("PARTNER") || name === "V-PARTNER")
      return "var(--v-partner)";
    return "var(--action-secondary)";
  };

  if (loading || !user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-2">
      <Menu />

      <div className={`content-area document-center`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">Gestão de Cursos</h2>
            <span className="content-subtitle">
              Gerenciamento de cursos para todas as empresas do grupo V-CORP.
            </span>
          </div>

          <button
            className="form-button form-button--add"
            onClick={openModalForCreate}
          >
            + Adicionar Curso
          </button>
        </div>

        {loadError ? (
          <p className="admin-courses-empty">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </p>
        ) : courses.length === 0 ? (
          <EmptyState
            imageKey="cursos"
            title="Nenhum curso encontrado"
            message="Crie o primeiro curso no botão “Adicionar Curso” acima."
          />
        ) : (
          <ul className="user-list">
            {courses.map((course) => (
              <li key={course.id} className="user-list-item">
                <div className="user-info admin-courses-user-info">
                  <img
                    src={
                      course.thumbnail_url ||
                      "https://res.cloudinary.com/dsgbgrll5/image/upload/v1756927817/ev4gvx4bqvz5x34ngrc8_x6fzrp.jpg"
                    }
                    alt="Thumbnail"
                    className="course-thumbnail"
                  />
                  <div className="course-list-item-info">
                    {/* Badge da Empresa */}
                    {course.company_name && (
                      <p
                        className={`company-badge company-${course.company_name
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {course.company_name}
                      </p>
                    )}
                    <br />
                    <strong>{course.title}</strong>
                  </div>
                </div>
                <div className="user-actions">
                  <button
                    className="form-icon-edit"
                    title="Gerenciar Aulas e Módulos"
                    onClick={() => handleManageContent(course.id)}
                  >
                    <FaChalkboardTeacher />
                  </button>
                  <button
                    className="form-icon-edit"
                    title="Editar Informações"
                    onClick={() => openModalForEdit(course)}
                  >
                    <FiEdit />
                  </button>
                  <button
                    className="form-icon-delete"
                    title="Excluir Curso"
                    onClick={() => handleDeleteClick(course.id)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Footer />

      {isModalOpen && (
        <CourseModal
          courseToEdit={editingCourse}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o curso "${
          courses.find((c) => c.id === courseToDelete)?.title
        }"? Todos os seus módulos e aulas também serão removidos.`}
      />
    </div>
  );
};

export default AdminCourses;
