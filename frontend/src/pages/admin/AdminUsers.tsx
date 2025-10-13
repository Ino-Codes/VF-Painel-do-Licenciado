// frontend/src/pages/admin/AdminUsers.tsx
import React, { useEffect, useState, useCallback } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import UserFormModal from "../../components/forms/UserFormModal.tsx";
import TabContent from "./TabContent.tsx";

const AdminUsers: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"licenciados" | "colaboradores">(
    "licenciados"
  );

  const [licenciadoState, setLicenciadoState] = useState({
    users: [],
    searchQuery: "",
    currentPage: 1,
    totalPages: 0,
  });
  const [colaboradorState, setColaboradorState] = useState({
    users: [],
    searchQuery: "",
    currentPage: 1,
    totalPages: 0,
  });

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const fetchUsers = useCallback(
    async (
      tab: "licenciados" | "colaboradores",
      page?: number,
      search?: string
    ) => {
      const isLicenciadoTab = tab === "licenciados";
      const state = isLicenciadoTab ? licenciadoState : colaboradorState;
      const setState = isLicenciadoTab
        ? setLicenciadoState
        : setColaboradorState;
      const roles = isLicenciadoTab ? "licenciado" : "colaborador,admin";

      try {
        const params = {
          page: page || state.currentPage,
          limit: 10,
          roles,
          search: search || state.searchQuery,
        };
        const res = await api.get("/api/users/admin", { params });
        setState((prev) => ({
          ...prev,
          users: res.data.users,
          totalPages: res.data.totalPages,
        }));
      } catch (err) {
        toast.error(`Não foi possível carregar os ${tab}.`);
      }
    },
    [licenciadoState, colaboradorState]
  );

  const handleSearch = (tab: "licenciados" | "colaboradores", term: string) => {
    const setState =
      tab === "licenciados" ? setLicenciadoState : setColaboradorState;
    setState((prev) => ({ ...prev, searchQuery: term, currentPage: 1 }));
    fetchUsers(tab, 1, term);
  };

  const handlePageChange = (
    tab: "licenciados" | "colaboradores",
    newPage: number
  ) => {
    const setState =
      tab === "licenciados" ? setLicenciadoState : setColaboradorState;
    setState((prev) => ({ ...prev, currentPage: newPage }));
    fetchUsers(tab, newPage);
  };

  const handleDeleteClick = (id: number) => {
    if (user?.id === id) {
      toast.error("Não pode excluir a sua própria conta.");
      return;
    }
    setUserToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete === null) return;
    try {
      await api.delete(`/api/users/admin/${userToDelete}`);
      toast.success("Usuário excluído!");
      fetchUsers(activeTab);
    } catch (err) {
      toast.error("Erro ao excluir.");
    } finally {
      setIsConfirmModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleOpenEditModal = (userToEdit: any) => {
    setEditingUser(userToEdit);
    setIsFormModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    fetchUsers(activeTab);
  };

  useEffect(() => {
    if (user) {
      fetchUsers("licenciados");
      fetchUsers("colaboradores");
    }
  }, [user]);

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Gestão de Usuários</h2>
        <div className="tabs">
          <button
            className={`tab-item ${
              activeTab === "licenciados" ? "active" : ""
            }`}
            onClick={() => setActiveTab("licenciados")}
          >
            Licenciados
          </button>
          <button
            className={`tab-item ${
              activeTab === "colaboradores" ? "active" : ""
            }`}
            onClick={() => setActiveTab("colaboradores")}
          >
            Colaboradores
          </button>
        </div>

        {activeTab === "licenciados" ? (
          <TabContent
            key="licenciados"
            tab="licenciados"
            state={licenciadoState}
            currentUser={user}
            setEditingUser={handleOpenEditModal}
            onAddClick={handleOpenCreateModal}
            handleSearch={handleSearch}
            handlePageChange={handlePageChange}
            handleDeleteClick={handleDeleteClick}
            fetchUsers={fetchUsers}
          />
        ) : (
          <TabContent
            key="colaboradores"
            tab="colaboradores"
            state={colaboradorState}
            currentUser={user}
            setEditingUser={handleOpenEditModal}
            onAddClick={handleOpenCreateModal}
            handleSearch={handleSearch}
            handlePageChange={handlePageChange}
            handleDeleteClick={handleDeleteClick}
            fetchUsers={fetchUsers}
          />
        )}
      </div>
      <Footer />
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={handleFormSuccess}
        userToEdit={editingUser}
        formType={activeTab === "licenciados" ? "licenciado" : "interno"}
      />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem a certeza de que deseja excluir este usuário?"
      />
    </div>
  );
};

export default AdminUsers;
