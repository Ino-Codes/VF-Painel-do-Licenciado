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
    const snippet = `<script src="${window.location.origin}/widget.js" data-token="${t.token}"></script>`;
    navigator.clipboard.writeText(snippet);
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
          className="btn-back-subtle"
          style={{ textDecoration: "none", marginBottom: "16px" }}
        >
          <FaArrowLeftLong />
          Voltar
        </Link>

        <div className="recruitment-header">
          <h1 className="recruitment-title">Sistemas Integrados</h1>

          <div className="recruitment-actions">
            <button className="form-button" onClick={openCreate}>
              + Token
            </button>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum sistema cadastrado ainda.</p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginTop: "6px",
              }}
            >
              Cadastre um sistema para gerar o token e o snippet do widget.
            </p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {tenants.map((t) => (
              <div
                key={t.id}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "20px 24px",
                  opacity: t.active ? 1 : 0.6,
                  transition: "opacity 0.2s ease",
                }}
              >
                {/* Linha 1: Nome + status + ações */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "20px",
                        background: t.active
                          ? "var(--bg-result-green)"
                          : "var(--bg-result-red)",
                        color: t.active
                          ? "var(--action-success)"
                          : "var(--text-secondary)",
                        border: `1px solid ${t.active ? "var(--action-primary)" : "var(--action-danger)"}`,
                      }}
                    >
                      {t.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
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
                <div style={{ marginBottom: "14px" }}>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Token de autenticação
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {t.token}
                    </code>
                    <button
                      className="form-icon-edit"
                      title="Copiar token"
                      onClick={() => copyToken(t)}
                      style={{ flexShrink: 0 }}
                      disabled={!t.active}
                    >
                      <FiCopy size={14} />
                    </button>
                  </div>
                </div>

                {/* Linha 3: Snippet */}
                <div style={{ marginBottom: "14px" }}>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Code Snippet do Widget
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        color: "var(--text-primary)",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {`<script src="${window.location.origin}/widget.js" data-api="${window.location.origin}"> data-token="${t.token}"></script>`}
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
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
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
          <div className="modal-content" style={{ maxWidth: "460px" }}>
            <h2>
              {editTenant ? "Editar Integração" : "Novo Token de Integração"}
            </h2>

            <div className="form-row" style={{ marginTop: "8px" }}>
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
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  margin: "0 0 16px 0",
                  lineHeight: 1.5,
                }}
              >
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
