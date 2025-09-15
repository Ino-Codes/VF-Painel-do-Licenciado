import React, { useEffect, useState, useCallback } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "colaborador";
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
}

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
      const res = await api.post("/api/users/admin/bulk-upload", formData, {
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

const AdminUsers: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [formType, setFormType] = useState<"licenciado" | "interno">(
    "licenciado"
  );
  const [form, setForm] = useState({
    nome: "",
    email: "",
    password: "",
    role: "licenciado" as User["role"],
    birth_date: "",
    cargo: "",
    setor: "",
  });

  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const params: any = { page: currentPage, limit };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get("/api/users/admin", { params });
      setUsers(res.data.users);
      setTotalUsers(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
      toast.error("Não foi possível carregar os usuários.");
    }
  }, [user, currentPage, limit, searchQuery]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nome: "",
      email: "",
      password: "",
      birth_date: "",
      role: formType === "licenciado" ? "licenciado" : "colaborador",
    }));
  }, [formType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUser) {
        if (editingUser.role !== "licenciado" && !editingUser.birth_date) {
          toast.error("A data de nascimento é obrigatória para colaboradores.");
          return;
        }
        await api.put(`/api/users/admin/${editingUser.id}`, editingUser);
        toast.success("Usuário atualizado com sucesso!");
        setEditingUser(null);
      } else {
        await api.post("/api/users/admin", form);
        toast.success("Usuário criado com sucesso!");
        setForm({
          nome: "",
          email: "",
          password: "",
          birth_date: "",
          cargo: "",
          setor: "",
          role: formType === "licenciado" ? "licenciado" : "colaborador",
        });
      }
      fetchUsers();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || "Ocorreu um erro ao salvar o usuário.";
      toast.error(errorMessage);
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
      await api.delete(`/api/users/admin/${userToDelete}`);
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
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchQuery(searchTerm);
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }
  if (!user || user.role !== "admin") {
    return null;
  }

  const renderForm = () => {
    if (editingUser) {
      return (
        <form onSubmit={handleSubmit} className="admin-form">
          <p>
            Editando: <strong>{editingUser.nome}</strong>
          </p>
          <div className="form-row">
            <input
              className="form-input"
              placeholder="Nome"
              value={editingUser.nome}
              onChange={(e) =>
                setEditingUser({ ...editingUser, nome: e.target.value })
              }
              required
            />
            <input
              className="form-input"
              placeholder="Email"
              type="email"
              value={editingUser.email}
              onChange={(e) =>
                setEditingUser({ ...editingUser, email: e.target.value })
              }
              required
            />
          </div>
          <div className="form-row">
            <select
              className="form-select"
              value={editingUser.role}
              onChange={(e) => {
                const newRole = e.target.value as User["role"];
                setEditingUser({ ...editingUser, role: newRole });
              }}
            >
              <option value="licenciado">Licenciado</option>
              <option value="colaborador">Colaborador</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {editingUser.role !== "licenciado" && (
            <div className="form-row">
              <label style={{ fontWeight: 500 }}>Data de Nascimento</label>
              <input
                className="form-input"
                type="date"
                value={
                  editingUser.birth_date
                    ? editingUser.birth_date.substring(0, 10)
                    : ""
                }
                onChange={(e) =>
                  setEditingUser({ ...editingUser, birth_date: e.target.value })
                }
                required
              />
            </div>
          )}

          <div className="form-row">
            <button className="form-button" type="submit">
              Salvar Alterações
            </button>
            <button
              className="form-button-cancel"
              type="button"
              onClick={() => setEditingUser(null)}
            >
              Cancelar Edição
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-row">
          <input
            className="form-input"
            placeholder="Nome Completo"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <input
            className="form-input"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <input
            className="form-input"
            placeholder="Senha"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        {form.role !== "licenciado" && (
          <div>
            <div className="form-row">
              <input
                className="form-input"
                placeholder="Cargo"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              />
              <input
                className="form-input"
                placeholder="Setor"
                value={form.setor}
                onChange={(e) => setForm({ ...form, setor: e.target.value })}
              />
            </div>

            <div className="form-row">
              <select
                className="form-select"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as User["role"] })
                }
              >
                <option value="colaborador">Colaborador</option>
                <option value="admin">Admin</option>
              </select>

              <label style={{ fontWeight: 500 }}>Data de Nascimento</label>
              <input
                className="form-input"
                type="date"
                value={form.birth_date}
                onChange={(e) =>
                  setForm({ ...form, birth_date: e.target.value })
                }
                required
              />
            </div>
          </div>
        )}

        <div className="form-row">
          <button className="form-button" type="submit">
            Criar Usuário
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>{editingUser ? "Editar Usuário" : "Criar Novo Usuário"}</h2>

        {!editingUser && (
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button
              className={`tab-item ${
                formType === "licenciado" ? "active" : ""
              }`}
              onClick={() => setFormType("licenciado")}
            >
              Licenciado
            </button>
            <button
              className={`tab-item ${formType === "interno" ? "active" : ""}`}
              onClick={() => setFormType("interno")}
            >
              Colaborador / Admin
            </button>
          </div>
        )}

        {renderForm()}

        {formType === "licenciado" && (
          <BulkUserImport onImportSuccess={fetchUsers} />
        )}

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
                <button className="list-button" onClick={() => startEdit(u)}>
                  Editar
                </button>
                <button
                  className="delete-button"
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
            <div>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="list-button"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="list-button"
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
