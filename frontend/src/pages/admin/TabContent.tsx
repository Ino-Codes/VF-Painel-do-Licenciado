import React, { useState } from "react";
import BulkUserImport from "./BulkUserImport.tsx";

const TabContent: React.FC<{
  tab: "licenciados" | "colaboradores";
  state: { users: any[]; totalPages: number; currentPage: number };
  currentUser: any;
  onAddClick: () => void;
  handleSearch: (tab: any, term: string) => void;
  setEditingUser: (user: any) => void;
  handleDeleteClick: (id: number) => void;
  handlePageChange: (tab: any, page: number) => void;
  fetchUsers: (tab: any) => void;
}> = ({
  tab,
  state,
  currentUser,
  onAddClick,
  handleSearch,
  setEditingUser,
  handleDeleteClick,
  handlePageChange,
  fetchUsers,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const isLicenciadoTab = tab === "licenciados";

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "20px" }}>
        <h3>
          {isLicenciadoTab ? "Cadastrar Licenciado" : "Cadastrar Colaborador"}
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
      <ul className="user-list">
        {state.users.map((u) => (
          <li key={u.id} className="user-list-item">
            <div className="user-info">
              <strong>{u.nome}</strong>
              <span>
                {u.email} ({u.role}) {u.unidade && `- ${u.unidade}`}
              </span>
            </div>
            <div className="user-actions">
              <button className="list-button" onClick={() => setEditingUser(u)}>
                Editar
              </button>
              <button
                className="delete-button"
                onClick={() => handleDeleteClick(u.id)}
                disabled={currentUser.id === u.id}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
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
