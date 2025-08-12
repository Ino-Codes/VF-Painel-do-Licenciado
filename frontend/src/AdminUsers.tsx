import React, { useEffect, useState, useCallback } from "react";
import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "gestor" | "executivo de contas";
}

// Componente para a funcionalidade de importação em massa
const BulkUserImport: React.FC<{ onImportSuccess: () => void }> = ({
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo CSV.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/admin/users/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { successCount, errorCount, errors } = res.data;

      toast.success(`${successCount} usuários importados com sucesso!`);
      if (errorCount > 0) {
        const errorDetails = errors.slice(0, 3).join("\n");
        toast.error(
          `${errorCount} usuários falharam.\nDetalhes:\n${errorDetails}...`,
          { duration: 6000 }
        );
        console.error("Erros de importação:", errors);
      }

      onImportSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro grave durante o upload.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="bulk-import-section">
      <h3>Importar Usuários em Massa</h3>
      <p>
        Selecione um arquivo .csv com as colunas:{" "}
        <strong>nome, email, password, role</strong>
      </p>
      <div className="form-row">
        <input type="file" accept=".csv" onChange={handleFileChange} />
        <button
          className="form-button"
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          {isUploading ? "Importando..." : "Importar Arquivo"}
        </button>
      </div>
    </div>
  );
};

// Componente principal da página
const AdminUsers: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    role: "licenciado" as
      | "admin"
      | "licenciado"
      | "gestor"
      | "executivo de contas",
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/");
      } else if (user.role !== "admin") {
        toast.error("Acesso restrito a administradores.");
        navigate("/dashboard");
      }
    }
  }, [user, loading, navigate]);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const params: any = { page: currentPage, limit };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get("/api/admin/users", { params });
      setUsers(res.data.users);
      setTotalUsers(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
      toast.error("Não foi possível carregar os usuários.");
    }
  }, [user, currentPage, limit, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [limit, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/api/admin/users/${editingUser.id}`, {
          nome: editingUser.nome,
          role: editingUser.role,
        });
        toast.success("Usuário atualizado com sucesso!");
        setEditingUser(null);
      } else {
        await api.post("/api/admin/users", form);
        toast.success("Usuário criado com sucesso!");
        setForm({ nome: "", email: "", password: "", role: "licenciado" });
      }
      fetchUsers();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o usuário.");
    }
  };

  const handleDeleteClick = (id: number) => {
    if (user && user.id === id) {
      toast.error("Você não pode excluir sua própria conta de administrador.");
      return;
    }
    setUserToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete === null) return;
    try {
      await api.delete(`/api/admin/users/${userToDelete}`);
      toast.success("Usuário excluído com sucesso!");
      fetchUsers();
    } catch (err) {
      toast.error("Erro ao excluir o usuário.");
    } finally {
      setIsConfirmModalOpen(false);
      setUserToDelete(null);
    }
  };

  const startEdit = (u: User) => {
    setEditingUser(u);
    // Limpa o formulário de criação para não manter dados antigos
    setForm({ nome: "", email: "", password: "", role: "licenciado" });
  };

  const handleSearch = () => {
    setSearchQuery(searchTerm);
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>{editingUser ? "Editar Usuário" : "Criar Usuário"}</h2>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Nome"
              value={editingUser ? editingUser.nome : form.nome}
              onChange={(e) => {
                if (editingUser)
                  setEditingUser({ ...editingUser, nome: e.target.value });
                else setForm({ ...form, nome: e.target.value });
              }}
              required
            />
            {!editingUser && (
              <>
                <input
                  className="form-input"
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Senha"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />
              </>
            )}
          </div>

          <div className="form-row">
            <select
              className="form-select"
              value={editingUser ? editingUser.role : form.role}
              onChange={(e) => {
                const newRole = e.target.value as
                  | "admin"
                  | "licenciado"
                  | "gestor"
                  | "executivo de contas";
                if (editingUser)
                  setEditingUser({ ...editingUser, role: newRole });
                else setForm({ ...form, role: newRole });
              }}
            >
              <option value="licenciado">Licenciado</option>
              <option value="admin">Admin</option>
              <option value="gestor">Gestor</option>
              <option value="executivo de contas">Executivo de Contas</option>
            </select>
          </div>

          <div className="form-row">
            <button className="form-button" type="submit">
              {editingUser ? "Salvar Alterações" : "Criar Usuário"}
            </button>
            {editingUser && (
              <button
                className="form-button-cancel"
                type="button"
                onClick={() => setEditingUser(null)}
              >
                Cancelar Edição
              </button>
            )}
          </div>
        </form>

        <BulkUserImport onImportSuccess={fetchUsers} />

        <h2>Usuários Cadastrados:</h2>
        <div className="search-bar">
          <input
            type="search"
            placeholder="Pesquisar por nome ou e-mail..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button type="button" className="form-button" onClick={handleSearch}>
            Pesquisar
          </button>
        </div>

        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id} className="user-list-item">
              <div className="user-info">
                <strong>{u.nome}</strong>
                <span>
                  {u.email} ({u.role})
                </span>
              </div>
              <div className="user-actions">
                <button
                  className="list-button edit"
                  onClick={() => startEdit(u)}
                >
                  Editar
                </button>
                <button
                  className="list-button delete"
                  onClick={() => handleDeleteClick(u.id)}
                  disabled={user.id === u.id}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>

        {totalUsers > 0 && (
          <div className="pagination-controls">
            <div className="limit-selector">
              <label htmlFor="limit">Itens por página:</label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div className="page-buttons">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default AdminUsers;
