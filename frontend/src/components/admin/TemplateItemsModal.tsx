import React, { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";
import { FiTrash2, FiSave, FiPlus } from "react-icons/fi";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";

interface Item {
  id: number;
  task_name: string;
  due_days?: number | null;
}

interface Props {
  templateId: number;
  templateName?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const TemplateItemsModal: React.FC<Props> = ({
  templateId,
  templateName,
  onClose,
  onSaved,
}) => {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newDueDays, setNewDueDays] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [nameEditing, setNameEditing] = useState<string>(templateName || "");
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(
          `/api/recruitment/checklist-templates/${templateId}/items`
        );
        setItems(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar itens");
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // sync nameEditing when templateName prop changes
  React.useEffect(() => {
    setNameEditing(templateName || "");
  }, [templateName]);

  const saveTemplateName = async () => {
    if (!nameEditing.trim()) return;
    setIsSavingName(true);
    try {
      const res = await api.put(
        `/api/recruitment/checklist-templates/${templateId}`,
        {
          name: nameEditing,
          is_default: false,
        }
      );
      toast.success("Nome do template atualizado");
      onSaved && onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar nome do template");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post(
        `/api/recruitment/checklist-templates/${templateId}/items`,
        {
          task_name: newName,
          due_days: newDueDays ? parseInt(newDueDays, 10) : null,
        }
      );
      setItems((p) => [...p, res.data]);
      setNewName("");
      setNewDueDays("");
      toast.success("Item adicionado");
      onSaved && onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar item");
    }
  };

  const handleDelete = (item: Item) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(
        `/api/recruitment/checklist-templates/items/${deleteItem.id}`
      );
      setItems((p) => p.filter((it) => it.id !== deleteItem.id));
      toast.success("Item excluído");
      setDeleteItem(null);
      onSaved && onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir item");
    }
  };

  const handleUpdate = async (
    id: number,
    name: string,
    due_days?: number | null
  ) => {
    try {
      const res = await api.put(
        `/api/recruitment/checklist-templates/items/${id}`,
        {
          task_name: name,
          due_days: due_days || null,
        }
      );
      setItems((p) => p.map((it) => (it.id === id ? res.data : it)));
      toast.success("Item atualizado");
      onSaved && onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar item");
    }
  };

  if (!templateId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          <IoCloseSharp />
        </button>
        <div className="admin-form">
          <h3>Edição do Template</h3>

          <div className="form-row">
            <input
              className="form-input"
              value={nameEditing}
              onChange={(e) => setNameEditing(e.target.value)}
              placeholder="Nome do template"
            />
            <button
              className="form-button"
              onClick={saveTemplateName}
              disabled={isSavingName}
            >
              Salvar
            </button>
          </div>

          <div className="form-row-divisor"></div>

          {items.map((it) => (
            <div className="form-row">
              <span className="form-span">{it.task_name}</span>
              <span className="form-span">{it.due_days}</span>

              <button
                className="form-icon-delete"
                onClick={() => handleDelete(it)}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}

          <div className="form-row">
            <input
              className="form-input"
              placeholder="Nome da tarefa"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="form-input"
              placeholder="Prazo (dias)"
              value={newDueDays}
              onChange={(e) => setNewDueDays(e.target.value)}
            />
            <button className="form-icon-save" onClick={handleAdd}>
              <FiPlus />
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        title={`Excluir Item ${deleteItem?.task_name}`}
        message="Tem certeza que deseja excluir este item do template? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default TemplateItemsModal;
