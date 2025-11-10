import React, { useState } from "react";
import BulkUserImport from "./BulkUserImport.tsx";
import { useUnits } from "../../hooks/useUnits.ts";
import { FiTrash2, FiEdit } from "react-icons/fi";

interface User {
  id: number;
  nome: string;
  email: string;
  role: string;
  unit_id?: number;
  unidade?: string; // legacy support
}

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
  onAddClick,
  handleSearch,
  setEditingUser,
  handleDeleteClick,
  handlePageChange,
  handleSort,
}) => {
  const { getUnitNameById } = useUnits();
  const [searchTerm, setSearchTerm] = useState("");
  const isLicenciadoTab = tab === "licenciados";

  const getSortIcon = (key: string) => {
    if (state.sortConfig.key !== key) return null;
    if (state.sortConfig.order === "ASC") return " ↑";
    return " ↓";
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <h3>
          {isLicenciadoTab
            ? "Cadastrar ou Importar Licenciados"
            : "Cadastrar Colaborador"}
        </h3>
        <button className="form-button" onClick={onAddClick}>
          + Adicionar Novo
        </button>
      </div>

      {isLicenciadoTab && (
        <BulkUserImport onImportSuccess={() => fetchUsers(tab)} />
      )}

      <h2>Usuários Cadastrados</h2>
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
              {!isLicenciadoTab && (
                <th
                  onClick={() => handleSort(tab, "unidade")}
                  className="sortable-header"
                >
                  Unidade {getSortIcon("unidade")}
                </th>
              )}
              <th style={{ width: "150px" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id}>
                <td data-label="Nome">{u.nome}</td>
                <td data-label="Email">{u.email}</td>
                <td data-label="Tipo" style={{ textTransform: "capitalize" }}>
                  {u.role}
                </td>
                {!isLicenciadoTab && (
                  <td data-label="Unidade">
                    {getUnitNameById(u.unit_id) || u.unidade}
                  </td>
                )}
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
