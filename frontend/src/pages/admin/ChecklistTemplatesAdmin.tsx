import React, { useEffect, useState } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import TemplateItemsModal from "../../components/admin/TemplateItemsModal.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { FaArrowLeftLong } from "react-icons/fa6";

interface Template {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
}

const ChecklistTemplatesAdmin: React.FC = () => {
  const navigate = useNavigate();
  const api = useApi();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [itemsModalTemplateId, setItemsModalTemplateId] = useState<
    number | null
  >(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/recruitment/checklist-templates");
      setTemplates(res.data);
    } catch (err) {
      console.error("Erro ao carregar templates:", err);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post("/api/recruitment/checklist-templates", {
        name: newName,
      });
      setTemplates((p) => [...p, res.data]);
      setNewName("");
      toast.success("Template criado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar template");
    }
  };

  const handleDelete = async (t: Template) => {
    setDeleteTemplate(t);
  };

  const confirmDelete = async () => {
    if (!deleteTemplate) return;
    try {
      await api.delete(
        `/api/recruitment/checklist-templates/${deleteTemplate.id}`
      );
      setTemplates((p) => p.filter((t) => t.id !== deleteTemplate.id));
      toast.success("Template excluído");
      setDeleteTemplate(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir template");
    }
  };

  const handleSetDefault = async (t: Template) => {
    try {
      await api.put(`/api/recruitment/checklist-templates/${t.id}`, {
        name: t.name,
        is_default: true,
      });
      load();
      toast.success("Template definido como padrão");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao definir padrão");
    }
  };

  const handleEdit = (t: Template) => {
    setEditingTemplate(t);
  };

  const saveEdit = async () => {
    if (!editingTemplate) return;
    try {
      const res = await api.put(
        `/api/recruitment/checklist-templates/${editingTemplate.id}`,
        {
          name: editingTemplate.name,
          is_default: editingTemplate.is_default,
        }
      );
      setTemplates((p) =>
        p.map((it) => (it.id === res.data.id ? res.data : it))
      );
      setEditingTemplate(null);
      toast.success("Template atualizado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar");
    }
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <Link
          to="/admin/recrutamento"
          className="btn-back-subtle"
          style={{ textDecoration: "none" }}
        >
          <FaArrowLeftLong />
          Voltar
        </Link>

        <h2>Templates de Checklist</h2>
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          <input
            className="form-input"
            placeholder="Nome do novo template"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="form-button" onClick={handleCreate}>
            Criar
          </button>
        </div>

        {loading ? (
          <div>Carregando...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Padrão</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>
                    {editingTemplate && editingTemplate.id === t.id ? (
                      <input
                        className="form-input"
                        value={editingTemplate.name}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            name: e.target.value,
                          })
                        }
                      />
                    ) : (
                      t.name
                    )}
                  </td>
                  <td>{t.is_default ? "Sim" : "Não"}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    {editingTemplate && editingTemplate.id === t.id ? (
                      <>
                        <button className="form-button" onClick={saveEdit}>
                          Salvar
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => setEditingTemplate(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="form-button"
                          onClick={() => handleEdit(t)}
                        >
                          Editar
                        </button>
                        <button
                          className="list-button"
                          onClick={() => setItemsModalTemplateId(t.id)}
                        >
                          Itens
                        </button>
                        <button
                          className="form-button"
                          onClick={() => handleSetDefault(t)}
                        >
                          Definir Padrão
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(t)}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {itemsModalTemplateId && (
          <TemplateItemsModal
            templateId={itemsModalTemplateId}
            onClose={() => setItemsModalTemplateId(null)}
            onSaved={() => load()}
          />
        )}

        <ConfirmationModal
          isOpen={!!deleteTemplate}
          onClose={() => setDeleteTemplate(null)}
          onConfirm={confirmDelete}
          title={`Excluir Template ${deleteTemplate?.name}`}
          message="Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita."
        />
      </div>
      <Footer />
    </div>
  );
};

export default ChecklistTemplatesAdmin;
