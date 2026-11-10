import React, { useEffect, useState, useCallback } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import UserFormModal from "../../components/forms/UserFormModal.tsx";
import TabContent from "./TabContent.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role?: string;
  group_id?: number | null;
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
  unidade?: string;
  corporate_photo_url?: string;
  data_admissao?: string | null;
  convite_pendente?: boolean;
}

type SortConfig = {
  key: string;
  order: "ASC" | "DESC";
};

const AdminUsers: React.FC = () => {
  const { user, loading } = useAuth();

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
  const [loadError, setLoadError] = useState(false);

  // ── Convites de 1º acesso ──────────────────────────────────────────────
  const podeGerenciar =
    Array.isArray((user as any)?.permissions) &&
    (user as any).permissions.includes("users.manage");
  const [reenviandoId, setReenviandoId] = useState<number | null>(null);
  // Quantos receberiam o reenvio em massa na aba atual (exclui quem foi
  // convidado na última hora).
  const [convitesPendentes, setConvitesPendentes] = useState(0);
  const [isMassaOpen, setIsMassaOpen] = useState(false);
  const [enviandoMassa, setEnviandoMassa] = useState(false);

  const carregarPendentes = useCallback(() => {
    if (!podeGerenciar) return;
    api
      .get("/api/users/admin/convites/pendentes", {
        params: { internal: activeTab === "licenciados" ? "false" : "true" },
      })
      .then((res) => setConvitesPendentes(res.data.total || 0))
      .catch(() => setConvitesPendentes(0));
  }, [podeGerenciar, activeTab]);

  useEffect(() => {
    carregarPendentes();
  }, [carregarPendentes]);

  const handleReenviarConvite = async (alvo: User) => {
    setReenviandoId(alvo.id);
    try {
      const res = await api.post(`/api/users/admin/${alvo.id}/convite`);
      toast.success(res.data?.message || "Convite reenviado.");
      carregarPendentes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Não foi possível reenviar o convite.");
    } finally {
      setReenviandoId(null);
    }
  };

  const handleReenviarEmMassa = async () => {
    setEnviandoMassa(true);
    try {
      const res = await api.post("/api/users/admin/convites/reenviar-pendentes", {
        internal: activeTab === "licenciados" ? "false" : "true",
      });
      const { enviados = 0, falhas = [] } = res.data || {};
      if (falhas.length) {
        toast.error(
          `${enviados} convite(s) reenviado(s); ${falhas.length} falharam: ${falhas.join(", ")}.`,
          { duration: 10000 },
        );
      } else {
        toast.success(`${enviados} convite(s) reenviado(s).`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Não foi possível reenviar os convites.");
    } finally {
      setEnviandoMassa(false);
      setIsMassaOpen(false);
      carregarPendentes();
    }
  };

  useEffect(() => {
    if (!user) return;

    const isLicenciadoTab = activeTab === "licenciados";
    const state = isLicenciadoTab ? licenciadoState : colaboradorState;

    const params = {
      page: state.currentPage,
      limit: 10,
      // Interno vs licenciado agora é definido pela permissão internal_access
      // do grupo, não por uma lista fixa de roles.
      internal: isLicenciadoTab ? "false" : "true",
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
        setLoadError(false);
      })
      .catch((err) => {
        setLoadError(true);
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

  const handleSearch = (tab: "licenciados" | "interno", term: string) => {
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

  const handleFormSuccess = (updatedUser?: User) => {
    setIsFormModalOpen(false);
    setEditingUser(null);

    if (updatedUser) {
      // Se um usuário foi editado, atualiza ele na lista existente
      const setState =
        activeTab === "licenciados" ? setLicenciadoState : setColaboradorState;
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === updatedUser.id ? updatedUser : u
        ),
      }));
    } else {
      // Se um novo usuário foi criado, reseta a busca para recarregar a lista
      const setState =
        activeTab === "licenciados" ? setLicenciadoState : setColaboradorState;
      setState((prev) => ({ ...prev, currentPage: 1, searchQuery: "" }));
      carregarPendentes();
    }
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
    return <LoadingSpinner />;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">

        <div className="document-header">
          <div>
            <h2 className="content-title">Gestão de Usuários</h2>
          </div>
          <div className="admin-users-header-actions">
            {podeGerenciar && convitesPendentes > 0 && (
              <button
                type="button"
                className="form-button-cancel"
                onClick={() => setIsMassaOpen(true)}
                disabled={enviandoMassa}
              >
                {enviandoMassa
                  ? "Reenviando convites..."
                  : `Reenviar convites pendentes (${convitesPendentes})`}
              </button>
            )}
            <button
              className="form-button form-button--add"
              onClick={handleOpenCreateModal}
            >
              + Adicionar Novo
            </button>
          </div>
        </div>

        
        <div className="tabs">
          <button
            className={`tab-item ${
              activeTab === "licenciados" ? "active" : ""
            }`}
            onClick={() => setActiveTab("licenciados")}
          >
            V-Partners
          </button>

          <button
            className={`tab-item ${activeTab === "interno" ? "active" : ""}`}
            onClick={() => setActiveTab("interno")}
          >
            Colaboradores
          </button>
        </div>

        {loadError ? (
          <div className="tela-loading">
            Não foi possível carregar os dados. Tente novamente mais tarde.
          </div>
        ) : (
          <>
        {activeTab === "licenciados" && (
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
            handleReenviarConvite={podeGerenciar ? handleReenviarConvite : undefined}
            reenviandoId={reenviandoId}
          />
        )}
        {activeTab === "interno" && (
          <TabContent
            key="interno"
            tab="interno"
            state={colaboradorState}
            currentUser={user}
            setEditingUser={handleOpenEditModal}
            onAddClick={handleOpenCreateModal}
            handleSearch={handleSearch}
            handlePageChange={handlePageChange}
            handleDeleteClick={handleDeleteClick}
            handleSort={handleSort}
            handleReenviarConvite={podeGerenciar ? handleReenviarConvite : undefined}
            reenviandoId={reenviandoId}
          />
        )}
          </>
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

      <ConfirmationModal
        isOpen={isMassaOpen}
        onClose={() => !enviandoMassa && setIsMassaOpen(false)}
        onConfirm={handleReenviarEmMassa}
        title="Reenviar convites pendentes"
        message={`Será enviado um novo convite por e-mail para ${convitesPendentes} ${activeTab === "licenciados" ? "V-Partner(s)" : "colaborador(es)"} que ainda não criaram a senha. A senha atual dessas contas deixa de valer e só o link novo dá acesso (válido por 72 horas). Quem recebeu convite na última hora fica de fora. O envio pode levar cerca de 1 minuto.`}
        confirmLabel={enviandoMassa ? "Enviando..." : "Reenviar convites"}
        confirmClassName="form-button"
        confirmDisabled={enviandoMassa}
      />
    </div>
  );
};

export default AdminUsers;
