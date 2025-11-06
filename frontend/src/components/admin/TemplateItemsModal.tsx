import React, { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";

interface Item {
  id: number;
  task_name: string;
  due_days?: number | null;
}

interface Props {
  templateId: number;
  onClose: () => void;
  onSaved?: () => void;
}

const TemplateItemsModal: React.FC<Props> = ({
  templateId,
  onClose,
  onSaved,
}) => {
  const api = useApi();
  const [items, setItems] = useState<Item[]>([]);
  const [newName, setNewName] = useState("");
  const [newDueDays, setNewDueDays] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);

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
        <h3>Itens do Template</h3>

        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <input
                className="form-input"
                value={it.task_name}
                onChange={(e) =>
                  setItems((p) =>
                    p.map((x) =>
                      x.id === it.id ? { ...x, task_name: e.target.value } : x
                    )
                  )
                }
                style={{ flex: 1 }}
              />
              <input
                className="form-input"
                value={it.due_days == null ? "" : String(it.due_days)}
                onChange={(e) =>
                  setItems((p) =>
                    p.map((x) =>
                      x.id === it.id
                        ? {
                            ...x,
                            due_days: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          }
                        : x
                    )
                  )
                }
                placeholder="Prazo (dias)"
                style={{ width: 120 }}
              />
              <button
                className="form-button"
                onClick={() => handleUpdate(it.id, it.task_name, it.due_days)}
              >
                Salvar
              </button>
              <button
                className="delete-button"
                onClick={() => handleDelete(it)}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="form-input"
            placeholder="Nome do item"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Prazo (dias)"
            value={newDueDays}
            onChange={(e) => setNewDueDays(e.target.value)}
            style={{ width: 120 }}
          />
          <button className="form-button" onClick={handleAdd}>
            Adicionar
          </button>
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
