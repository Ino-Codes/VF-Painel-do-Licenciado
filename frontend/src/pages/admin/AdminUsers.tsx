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

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "comercial" | "rh" | "operacional";
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
  unidade?: string;
  corporate_photo_url?: string;
  data_admissao?: string | null;
}

type SortConfig = {
  key: string;
  order: "ASC" | "DESC";
};

const AdminUsers: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"licenciados" | "interno">(
    "licenciados"
  );

  const [licenciadoState, setLicenciadoState] = useState({
    users: [],
    searchQuery: "",
    currentPage: 1,
    totalPages: 0,
    sortConfig: { key: "nome", order: "ASC" } as SortConfig,
  });
  const [colaboradorState, setColaboradorState] = useState({
    users: [],
    searchQuery: "",
    currentPage: 1,
    totalPages: 0,
    sortConfig: { key: "nome", order: "ASC" } as SortConfig,
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const isLicenciadoTab = activeTab === "licenciados";
    const state = isLicenciadoTab ? licenciadoState : colaboradorState;
    const roles = isLicenciadoTab
      ? "licenciado"
      : "comercial,rh,operacional,admin";

    const params = {
      page: state.currentPage,
      limit: 10,
      roles,
      search: state.searchQuery,
      sortBy: state.sortConfig.key,
      sortOrder: state.sortConfig.order,
    };

    api
      .get("/api/users/admin", { params })
      .then((res) => {
        const setState = isLicenciadoTab
          ? setLicenciadoState
          : setColaboradorState;
        setState((prev) => ({
          ...prev,
          users: res.data.users,
          totalPages: res.data.totalPages,
        }));
      })
      .catch((err) => {
        toast.error(`Não foi possível carregar os ${activeTab}.`);
      });
  }, [
    user,
    activeTab,
    licenciadoState.currentPage,
    licenciadoState.searchQuery,
    licenciadoState.sortConfig,
    colaboradorState.currentPage,
    colaboradorState.searchQuery,
    colaboradorState.sortConfig,
  ]);

  const handleSort = (tab: "licenciados" | "interno", key: string) => {
    const setState =
      tab === "licenciados" ? setLicenciadoState : setColaboradorState;

    setState((prevState) => {
      let order: "ASC" | "DESC" = "ASC";
      if (
        prevState.sortConfig.key === key &&
        prevState.sortConfig.order === "ASC"
      ) {
        order = "DESC";
      }
      return { ...prevState, sortConfig: { key, order } };
    });
  };

  const handleSearch = (tab: "licenciados" | "colaboradores", term: string) => {
    const setState =
      tab === "licenciados" ? setLicenciadoState : setColaboradorState;
    setState((prev) => ({ ...prev, searchQuery: term, currentPage: 1 }));
  };

  const handlePageChange = (
    tab: "licenciados" | "colaboradores",
    newPage: number
  ) => {
    const setState =
      tab === "licenciados" ? setLicenciadoState : setColaboradorState;
    setState((prev) => ({ ...prev, currentPage: newPage }));
  };

  const handleConfirmDelete = async () => {
    if (userToDelete === null) return;
    try {
      await api.delete(`/api/users/admin/${userToDelete}`);
      toast.success("Usuário excluído!");
      const setState =
        activeTab === "licenciados" ? setLicenciadoState : setColaboradorState;
      setState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userToDelete),
      }));
    } catch (err) {
      toast.error("Erro ao excluir.");
    } finally {
      setIsConfirmModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    setIsFormModalOpen(false);
    const setState =
      activeTab === "licenciados" ? setLicenciadoState : setColaboradorState;
    setState((prev) => ({ ...prev, currentPage: 1, searchQuery: "" }));
  };

  const handleDeleteClick = (id: number) => {
    if (user?.id === id) {
      toast.error("Não pode excluir a sua própria conta.");
      return;
    }
    setUserToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleOpenEditModal = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setIsFormModalOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsFormModalOpen(true);
  };

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
            handleSort={handleSort}
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
            handleSort={handleSort}
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
