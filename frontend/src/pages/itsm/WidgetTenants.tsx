import React, { useState, useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import {
  FiPlus,
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiCheck,
  FiToggleLeft,
  FiToggleRight,
} from "react-icons/fi";
import { FaArrowLeftLong } from "react-icons/fa6";

interface Tenant {
  id: number;
  name: string;
  token: string;
  active: boolean;
  created_by_name: string;
  created_at: string;
}

// O widget.js, o widget-form.html e a rota POST /api/ticket são servidos pelo
// BACKEND — não pelo domínio do frontend. Por isso o snippet precisa apontar
// para a URL da API (src e data-api), senão o navegador do terceiro baixa o
// HTML da SPA no lugar do script.
const WIDGET_BASE =
  process.env.REACT_APP_API_URL ||
  "https://vf-painel-do-licenciado.onrender.com";

// Fonte única do snippet — evita divergência entre o texto exibido e o copiado.
const buildSnippet = (token: string) =>
  `<script src="${WIDGET_BASE}/widget.js" data-api="${WIDGET_BASE}" data-token="${token}"></script>`;

const WidgetTenantsPage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [formName, setFormName] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchTenants = async () => {
    try {
      const res = await api.get("/api/widget-tenants");
      setTenants(res.data);
    } catch {
      toast.error("Erro ao carregar sistemas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTenant(null);
    setFormName("");
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditTenant(t);
    setFormName(t.name);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTenant(null);
    setFormName("");
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("Nome do sistema é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      if (editTenant) {
        await api.put(`/api/widget-tenants/${editTenant.id}`, {
          name: formName.trim(),
          active: editTenant.active,
        });
        toast.success("Sistema atualizado!");
      } else {
        await api.post("/api/widget-tenants", { name: formName.trim() });
        toast.success("Sistema cadastrado com sucesso!");
      }
      closeModal();
      fetchTenants();
    } catch {
      toast.error("Erro ao salvar sistema.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: Tenant) => {
    try {
      await api.put(`/api/widget-tenants/${t.id}`, {
        name: t.name,
        active: !t.active,
      });
      toast.success(`Sistema ${!t.active ? "ativado" : "desativado"}.`);
      fetchTenants();
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleDelete = async (t: Tenant) => {
    if (
      !window.confirm(
        `Excluir "${t.name}"?\n\nTodos os tickets recebidos por este sistema também serão excluídos.`,
      )
    )
      return;

    try {
      await api.delete(`/api/widget-tenants/${t.id}`);
      toast.success("Token excluído.");
      fetchTenants();
    } catch {
      toast.error("Erro ao excluir token.");
    }
  };

  const handleRegenerateToken = async (t: Tenant) => {
    if (
      !window.confirm(
        `Regenerar o token de "${t.name}"?\n\nO token atual deixará de funcionar imediatamente e o widget instalado precisará ser atualizado.`,
      )
    )
      return;

    try {
      await api.post(`/api/widget-tenants/${t.id}/regenerate-token`);
      toast.success("Token regenerado com sucesso!");
      fetchTenants();
    } catch {
      toast.error("Erro ao regenerar token.");
    }
  };

  const copyToken = (t: Tenant) => {
    navigator.clipboard.writeText(t.token);
    setCopiedId(t.id);
    toast.success("Token copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copySnippet = (t: Tenant) => {
    navigator.clipboard.writeText(buildSnippet(t.token));
    toast.success("Snippet copiado!");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return <div className="loading-state">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <Link
          to="/admin/helpdesk"
          className="btn-back-subtle widget-tenants-back"
        >
          <FaArrowLeftLong />
          Voltar
        </Link>

        <div className="page-header">
          <h1 className="page-title">Sistemas Integrados</h1>

          <div className="page-actions">
            <button className="form-button" onClick={openCreate}>
              + Token
            </button>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum sistema cadastrado ainda.</p>
            <p className="widget-empty-hint">
              Cadastre um sistema para gerar o token e o snippet do widget.
            </p>
          </div>
        ) : (
          <div className="widget-tenants-list">
            {tenants.map((t) => (
              <div
                key={t.id}
                className={`widget-tenant-card${
                  t.active ? "" : " widget-tenant-card--inactive"
                }`}
              >
                {/* Linha 1: Nome + status + ações */}
                <div className="widget-tenant-card-header">
                  <div className="widget-tenant-title-row">
                    <span className="widget-tenant-name">{t.name}</span>
                    <span
                      className={`widget-status-badge ${
                        t.active
                          ? "widget-status-badge--active"
                          : "widget-status-badge--inactive"
                      }`}
                    >
                      {t.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="widget-tenant-actions">
                    {/* Toggle ativo/inativo */}
                    <button
                      className="form-icon-save"
                      title={t.active ? "Desativar" : "Ativar"}
                      onClick={() => handleToggleActive(t)}
                    >
                      {t.active ? <FiToggleRight /> : <FiToggleLeft />}
                    </button>

                    {/* Editar nome */}
                    <button
                      className="form-icon-edit"
                      title="Editar nome"
                      onClick={() => openEdit(t)}
                      disabled={!t.active}
                    >
                      <FiEdit2 />
                    </button>

                    {/* Regenerar token */}
                    <button
                      className="form-icon-edit"
                      title="Regenerar token"
                      onClick={() => handleRegenerateToken(t)}
                      disabled={!t.active}
                    >
                      <FiRefreshCw />
                    </button>

                    {/* Excluir */}
                    <button
                      className="form-icon-delete"
                      title="Excluir sistema"
                      onClick={() => handleDelete(t)}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                {/* Linha 2: Token */}
                <div className="widget-tenant-field">
                  <p className="widget-tenant-field-label">
                    Token de autenticação
                  </p>
                  <div className="widget-tenant-code-box">
                    <code className="widget-tenant-code">{t.token}</code>
                    <button
                      className="form-icon-edit"
                      title="Copiar token"
                      onClick={() => copyToken(t)}
                      disabled={!t.active}
                    >
                      <FiCopy size={14} />
                    </button>
                  </div>
                </div>

                {/* Linha 3: Snippet */}
                <div className="widget-tenant-field">
                  <p className="widget-tenant-field-label">
                    Code Snippet do Widget
                  </p>
                  <div className="widget-tenant-code-box widget-tenant-code-box--top">
                    <code className="widget-tenant-code widget-tenant-code--sm">
                      {buildSnippet(t.token)}
                    </code>
                    <button
                      className="form-icon-edit"
                      title="Copiar snippet"
                      onClick={() => copySnippet(t)}
                      disabled={!t.active}
                    >
                      <FiCopy size={14} />
                    </button>
                  </div>
                </div>

                {/* Linha 4: Meta */}
                <p className="widget-tenant-meta">
                  Cadastrado por <strong>{t.created_by_name || "—"}</strong> em{" "}
                  {new Date(t.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content widget-tenant-modal">
            <h2>
              {editTenant ? "Editar Integração" : "Novo Token de Integração"}
            </h2>

            <div className="form-row widget-tenant-modal-label-row">
              <label>Nome do Sistema:</label>
            </div>
            <div className="form-row">
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Valor Hub..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
              />
            </div>

            {!editTenant && (
              <p className="widget-tenant-modal-hint">
                Um token de autenticação será gerado automaticamente após o
                cadastro.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="form-button-cancel"
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="form-button"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default WidgetTenantsPage;
