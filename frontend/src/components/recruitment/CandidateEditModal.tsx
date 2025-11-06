import React, { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { IMaskInput } from "react-imask";
import { Candidate, Unit, Stage } from "../../types/recruitment.ts";

interface Props {
  candidate: Candidate;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CandidateEditModal: React.FC<Props> = ({
  candidate,
  isOpen,
  onClose,
  onSave,
}) => {
  const api = useApi();
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    name: candidate.name || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    role_applied_for: candidate.role_applied_for || "",
    status: candidate.status || "EM_PROCESSO",
    unit_id: candidate.unit_id || null,
  });

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const [uRes, sRes] = await Promise.all([api.get("/api/units")]);
        setUnits(uRes.data || []);
        setStages(sRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar dados do modal de edição:", err);
      }
    };
    load();
    // reset form when opening
    setFormData({
      name: candidate.name || "",
      email: candidate.email || "",
      phone: candidate.phone || "",
      role_applied_for: candidate.role_applied_for || "",
      status: candidate.status || "EM_PROCESSO",
      unit_id: candidate.unit_id || null,
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/\D/g, "") : null,
        unit_id: formData.unit_id || null,
      };

      await api.put(`/api/recruitment/candidates/${candidate.id}`, payload);
      toast.success("Candidato atualizado com sucesso");
      onSave();
      onClose();
    } catch (err) {
      console.error("Erro ao atualizar candidato:", err);
      toast.error("Erro ao salvar alterações");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">Editar Candidato</h2>

        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label>Nome</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              className="form-input"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((p) => ({ ...p, email: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Telefone</label>
            <IMaskInput
              mask="(00) 00000-0000"
              className="form-input"
              value={formData.phone}
              onAccept={(value: any) =>
                setFormData((p) => ({ ...p, phone: value }))
              }
              unmask={false}
              required
            />
          </div>

          <div className="form-group">
            <label>Cargo</label>
            <input
              className="form-input"
              value={formData.role_applied_for}
              onChange={(e) =>
                setFormData((p) => ({ ...p, role_applied_for: e.target.value }))
              }
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unidade</label>
              <select
                className="form-input"
                value={formData.unit_id ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    unit_id: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              >
                <option value="">Selecione a unidade</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="form-button-cancel"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="form-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateEditModal;
