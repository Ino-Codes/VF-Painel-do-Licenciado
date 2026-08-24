import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import toast from "react-hot-toast";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi";

interface Group {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
  member_count: number;
}

interface CatalogScreen {
  key: string;
  label: string;
  viewKey: string;
  manageKey: string | null;
}

interface Catalog {
  screens: Record<string, CatalogScreen[]>;
  standalone: { key: string; label: string; category: string }[];
}

// Grupos protegidos contra exclusão (espelha PROTECTED_GROUP_SLUGS no backend).
const PROTECTED_GROUP_SLUGS = ["administrador", "licenciado"];

const GroupsManagement: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const canManage = hasPermission("groups.manage");

  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [gRes, cRes] = await Promise.all([
        api.get("/api/groups"),
        api.get("/api/groups/permissions-catalog"),
      ]);
      setGroups(gRes.data);
      setCatalog(cRes.data);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar grupos e permissões.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setSelected(new Set());
    setModalOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setForm({ name: g.name, description: g.description || "" });
    setSelected(new Set(g.permissions));
    setModalOpen(true);
  };

  const togglePerm = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do grupo.");
      return;
    }
    setSaving(true);
    try {
      const permissions = Array.from(selected);
      if (editing) {
        await api.put(`/api/groups/${editing.id}`, {
          name: form.name,
          description: form.description,
        });
        await api.put(`/api/groups/${editing.id}/permissions`, { permissions });
        toast.success("Grupo atualizado.");
      } else {
        await api.post("/api/groups", {
          name: form.name,
          description: form.description,
          permissions,
        });
        toast.success("Grupo criado.");
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Erro ao salvar grupo.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/groups/${groupToDelete.id}`);
      toast.success("Grupo excluído.");
      setGroupToDelete(null);
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Erro ao excluir grupo.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteMessage = (g: Group) => {
    const base = `Tem certeza que deseja excluir o grupo "${g.name}"? Esta ação não pode ser desfeita.`;
    if (g.member_count > 0) {
      return `${g.member_count} usuário${
        g.member_count !== 1 ? "s" : ""
      } ficará${
        g.member_count !== 1 ? "o" : ""
      } sem grupo (órfão${
        g.member_count !== 1 ? "s" : ""
      } de grupo) e perderá${
        g.member_count !== 1 ? "o" : ""
      } as permissões associadas.\n\n${base}`;
    }
    return `Nenhum usuário está vinculado a este grupo.\n\n${base}`;
  };

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">
        <div className="document-header">
          <h2 className="content-title">Grupos &amp; Permissões</h2>
          {canManage && (
            <button
              className="form-button form-button--add"
              onClick={openCreate}
            >
              + Adicionar Novo
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="tela-loading stats-loading-box">
            Carregando dados...
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Descrição</th>
                  <th className="stats-th-center">Permissões</th>
                  <th className="stats-th-center">Membros</th>
                  <th className="stats-th-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Grupo" className="file-cell">
                      <HiOutlineUserGroup color="var(--brand-gold)" />
                      {g.name}
                      {g.is_system && (
                        <span className="group-system-badge">sistema</span>
                      )}
                    </td>
                    <td data-label="Descrição">{g.description || "—"}</td>
                    <td data-label="Permissões" className="stats-count-cell">
                      <span className="count-badge">{g.permissions.length}</span>
                    </td>
                    <td data-label="Membros" className="stats-count-cell">
                      {g.member_count}
                    </td>
                    <td data-label="Ações" className="stats-count-cell">
                      <div className="user-actions user-actions--center">
                        <button
                          className="form-icon-edit"
                          title={canManage ? "Editar" : "Ver permissões"}
                          onClick={() => openEdit(g)}
                        >
                          <FiEdit />
                        </button>
                        {canManage && (
                          <button
                            className="form-icon-delete"
                            title={
                              PROTECTED_GROUP_SLUGS.includes(g.slug)
                                ? "Este grupo é protegido e não pode ser excluído"
                                : "Excluir"
                            }
                            disabled={PROTECTED_GROUP_SLUGS.includes(g.slug)}
                            onClick={() => setGroupToDelete(g)}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="stats-empty-cell">
                      Nenhum grupo cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && catalog && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content modal-wide groups-perm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-button"
              onClick={() => setModalOpen(false)}
            >
              ×
            </button>

            <div className="perm-modal-head">
              <span className="perm-modal-icon">
                <HiOutlineUserGroup />
              </span>
              <div>
                <h3 className="perm-modal-title">
                  {editing ? editing.name : "Novo grupo"}
                </h3>
                <p className="perm-modal-subtitle">
                  {canManage
                    ? "Defina o nome e marque as permissões de cada tela."
                    : "Visualização das permissões deste grupo."}
                </p>
              </div>
            </div>

            <div className="perm-form-grid">
              <div className="perm-field">
                <label htmlFor="grp-name">Nome</label>
                <input
                  id="grp-name"
                  className="form-input"
                  placeholder="Ex.: Comercial"
                  value={form.name}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="perm-field">
                <label htmlFor="grp-desc">Descrição</label>
                <input
                  id="grp-desc"
                  className="form-input"
                  placeholder="Breve descrição do grupo (opcional)"
                  value={form.description}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="perm-matrix-toolbar">
              <span className="perm-matrix-label">Permissões</span>
              <span className="perm-matrix-total">
                {selected.size} selecionada{selected.size !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="perm-matrix">
              {Object.entries(catalog.screens).map(([category, screens]) => {
                const catKeys = screens.flatMap((s) =>
                  s.manageKey ? [s.viewKey, s.manageKey] : [s.viewKey],
                );
                const catSelected = catKeys.filter((k) =>
                  selected.has(k),
                ).length;
                return (
                  <div className="perm-category" key={category}>
                    <div className="perm-category-head">
                      <h4 className="perm-category-title">{category}</h4>
                      <span
                        className={`perm-category-count${
                          catSelected > 0 ? " is-active" : ""
                        }`}
                      >
                        {catSelected}/{catKeys.length}
                      </span>
                    </div>
                    <table className="perm-table">
                      <thead>
                        <tr>
                          <th>Tela</th>
                          <th className="perm-col">Ver</th>
                          <th className="perm-col">Gerenciar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screens.map((s) => (
                          <tr key={s.key}>
                            <td>{s.label}</td>
                            <td className="perm-col">
                              <label className="perm-check">
                                <input
                                  type="checkbox"
                                  checked={selected.has(s.viewKey)}
                                  disabled={!canManage}
                                  onChange={() => togglePerm(s.viewKey)}
                                />
                                <span className="perm-check-box" />
                              </label>
                            </td>
                            <td className="perm-col">
                              {s.manageKey ? (
                                <label className="perm-check">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(s.manageKey)}
                                    disabled={!canManage}
                                    onChange={() => togglePerm(s.manageKey!)}
                                  />
                                  <span className="perm-check-box" />
                                </label>
                              ) : (
                                <span className="perm-na">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {catalog.standalone.length > 0 && (
                <div className="perm-category">
                  <div className="perm-category-head">
                    <h4 className="perm-category-title">Especial</h4>
                    <span
                      className={`perm-category-count${
                        catalog.standalone.some((s) => selected.has(s.key))
                          ? " is-active"
                          : ""
                      }`}
                    >
                      {
                        catalog.standalone.filter((s) => selected.has(s.key))
                          .length
                      }
                      /{catalog.standalone.length}
                    </span>
                  </div>
                  <div className="perm-standalone-list">
                    {catalog.standalone.map((s) => (
                      <label className="perm-standalone" key={s.key}>
                        <input
                          type="checkbox"
                          checked={selected.has(s.key)}
                          disabled={!canManage}
                          onChange={() => togglePerm(s.key)}
                        />
                        <span className="perm-check-box" />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="form-button-cancel"
                onClick={() => setModalOpen(false)}
              >
                {canManage ? "Cancelar" : "Fechar"}
              </button>
              {canManage && (
                <button
                  className="form-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!groupToDelete}
        onClose={() => !deleting && setGroupToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir grupo"
        message={groupToDelete ? deleteMessage(groupToDelete) : ""}
      />
      <Footer />
    </div>
  );
};

export default GroupsManagement;
