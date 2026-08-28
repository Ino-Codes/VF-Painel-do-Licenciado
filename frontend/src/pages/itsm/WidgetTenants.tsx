import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import {
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
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
  const [saving, setSaving] = useState(false);
  // Ação destrutiva aguardando confirmação (substitui window.confirm).
  const [confirmState, setConfirmState] = useState<{
    action: "delete" | "regenerate";
    tenant: Tenant;
  } | null>(null);

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

  const performDelete = async (t: Tenant) => {
    try {
      await api.delete(`/api/widget-tenants/${t.id}`);
      toast.success("Token excluído.");
      fetchTenants();
    } catch {
      toast.error("Erro ao excluir token.");
    }
  };

  const performRegenerateToken = async (t: Tenant) => {
    try {
      await api.post(`/api/widget-tenants/${t.id}/regenerate-token`);
      toast.success("Token regenerado com sucesso!");
      fetchTenants();
    } catch {
      toast.error("Erro ao regenerar token.");
    }
  };

  // Abrem o modal de confirmação (a ação só ocorre no onConfirm).
  const handleDelete = (t: Tenant) =>
    setConfirmState({ action: "delete", tenant: t });
  const handleRegenerateToken = (t: Tenant) =>
    setConfirmState({ action: "regenerate", tenant: t });

  const copyToken = (t: Tenant) => {
    navigator.clipboard.writeText(t.token);
    toast.success("Token copiado!");
  };

  const copySnippet = (t: Tenant) => {
    navigator.clipboard.writeText(buildSnippet(t.token));
    toast.success("Snippet copiado!");
  };

  const copyInstructions = (t: Tenant) => {
    const text = [
      "Como integrar o widget de chamados ao seu site:",
      "",
      "1. Copie o Code Snippet do Widget abaixo:",
      buildSnippet(t.token),
      "",
      "2. Abra o arquivo HTML do site onde o widget deve aparecer. Em sites React, Vue ou Angular, use o index.html público do projeto.",
      "",
      "3. Cole o código dentro da tag <body>, logo antes do fechamento </body>.",
      "",
      "4. Salve e publique o site. Um botão flutuante de chamado aparecerá no canto inferior direito de todas as páginas.",
      "",
      "5. Pronto! Os chamados abertos por esse site chegam automaticamente na nossa Central de Chamados.",
      "",
      "Não é preciso instalar nada. O mesmo código funciona em qualquer site, com ou sem framework. O token identifica este sistema — mantenha-o apenas neste site.",
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Instruções copiadas!");
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
            <button
              className="form-button form-button--add"
              onClick={openCreate}
            >
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

                {/* Instruções de integração */}
                <div className="widget-tenant-field">
                  <p className="widget-tenant-field-label">
                    Instruções de Integração
                  </p>
                  <div className="widget-tenant-code-box widget-tenant-code-box--top">
                    <div className="widget-tenant-steps">
                      <ol className="widget-steps-list">
                        <li>
                          Copie o <strong>Code Snippet do Widget</strong> acima
                          (no botão de copiar).
                        </li>
                        <li>
                          Abra o arquivo HTML do site onde o widget deve
                          aparecer. Em sites React, Vue ou Angular, use o{" "}
                          <code>index.html</code> público do projeto.
                        </li>
                        <li>
                          Cole o código dentro da tag <code>&lt;body&gt;</code>,
                          logo antes do fechamento <code>&lt;/body&gt;</code>.
                        </li>
                        <li>
                          Salve e publique o site. Um botão flutuante de chamado
                          aparecerá no canto inferior direito de todas as
                          páginas.
                        </li>
                        <li>
                          Pronto! Os chamados abertos por esse site chegam
                          automaticamente na nossa Central de Chamados.
                        </li>
                      </ol>
                      <p className="widget-steps-note">
                        Não é preciso instalar nada. O mesmo código funciona em
                        qualquer site, com ou sem framework. O token acima
                        identifica este sistema — mantenha-o apenas neste site.
                      </p>
                    </div>
                    <button
                      className="form-icon-edit"
                      title="Copiar instruções"
                      onClick={() => copyInstructions(t)}
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
            <button type="button" className="modal-close-button" aria-label="Fechar" onClick={closeModal}>
              &times;
            </button>
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

      <ConfirmationModal
        isOpen={confirmState !== null}
        onClose={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) return;
          const { action, tenant } = confirmState;
          setConfirmState(null);
          if (action === "delete") performDelete(tenant);
          else performRegenerateToken(tenant);
        }}
        title={
          confirmState?.action === "delete"
            ? "Excluir Sistema"
            : "Regenerar Token"
        }
        message={
          confirmState
            ? confirmState.action === "delete"
              ? `Excluir "${confirmState.tenant.name}"? Todos os tickets recebidos por este sistema também serão excluídos.`
              : `Regenerar o token de "${confirmState.tenant.name}"? O token atual deixará de funcionar imediatamente e o widget instalado precisará ser atualizado.`
            : ""
        }
      />
      <Footer />
    </div>
  );
};

export default WidgetTenantsPage;
