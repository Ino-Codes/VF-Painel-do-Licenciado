import React, { useState } from "react";
import { FiTrash2, FiEdit } from "react-icons/fi";

interface User {
  id: number;
  nome: string;
  email: string;
  role: string;
  unit_id?: number;
  unidade?: string; // legacy support
}

// Rótulo visível do tipo de usuário. O `role` é legado e no banco o valor
// segue "licenciado"; na interface ele foi renomeado para "V-Partner".
// (A célula usa text-transform: capitalize para os demais tipos.)
const ROLE_LABELS: Record<string, string> = {
  licenciado: "V-Partner",
};
const formatRole = (role: string) =>
  ROLE_LABELS[(role || "").toLowerCase()] || role;

interface TabContentProps {
  tab: "licenciados" | "colaboradores";
  state: { users: User[]; totalPages: number; currentPage: number };
  currentUser: User;
  onAddClick: () => void;
  handleSearch: (tab: "licenciados" | "colaboradores", term: string) => void;
  setEditingUser: (user: User) => void;
  handleDeleteClick: (id: number) => void;
  handlePageChange: (
    tab: "licenciados" | "colaboradores",
    page: number
  ) => void;
  fetchUsers: (tab: "licenciados" | "colaboradores") => void;
  handleSort: (tab: "licenciados" | "interno", key: string) => void;
}

const TabContent: React.FC<TabContentProps> = ({
  tab,
  state,
  currentUser,
  handleSearch,
  setEditingUser,
  handleDeleteClick,
  handlePageChange,
  handleSort,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const getSortIcon = (key: string) => {
    if (state.sortConfig.key !== key) return null;
    if (state.sortConfig.order === "ASC") return " ↑";
    return " ↓";
  };

  return (
    <div>
      <div className="search-bar">
        <input
          type="search"
          placeholder="Pesquisar por nome ou e-mail..."
          className="form-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(tab, searchTerm)}
        />
        <button
          type="button"
          className="form-button"
          onClick={() => handleSearch(tab, searchTerm)}
        >
          Pesquisar
        </button>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort(tab, "nome")}
                className="sortable-header"
              >
                Nome {getSortIcon("nome")}
              </th>
              <th
                onClick={() => handleSort(tab, "email")}
                className="sortable-header"
              >
                Email {getSortIcon("email")}
              </th>
              <th
                onClick={() => handleSort(tab, "role")}
                className="sortable-header"
              >
                Tipo {getSortIcon("role")}
              </th>
              <th className="tab-users-actions-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id}>
                <td data-label="Nome">{u.nome}</td>
                <td data-label="Email">{u.email}</td>
                <td data-label="Tipo" className="tab-users-role-cell">
                  {formatRole(u.role)}
                </td>
                <td data-label="Ações">
                  <div className="user-actions">
                    <button
                      className="form-icon-edit"
                      onClick={() => setEditingUser(u)}
                    >
                      <FiEdit />
                    </button>

                    <button
                      className="form-icon-delete"
                      onClick={() => handleDeleteClick(u.id)}
                      disabled={currentUser.id === u.id}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.totalPages > 1 && (
        <div className="pagination-controls">
          <span>
            Página {state.currentPage} de {state.totalPages}
          </span>
          <div>
            <button
              onClick={() => handlePageChange(tab, state.currentPage - 1)}
              disabled={state.currentPage === 1}
              className="list-button"
            >
              Anterior
            </button>
            <button
              onClick={() => handlePageChange(tab, state.currentPage + 1)}
              disabled={state.currentPage === state.totalPages}
              className="list-button"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabContent;
