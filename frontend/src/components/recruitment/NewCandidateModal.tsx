import React, { useState } from "react";
import { useApi } from "../../hooks/useApi.ts";
import toast from "react-hot-toast";
import { Candidate, Unit } from "../../types/recruitment.ts";
import { useEffect } from "react";
import { IMaskInput } from "react-imask";
import { IoCloseSharp } from "react-icons/io5";

interface NewCandidateModalProps {
  onClose: () => void;
  onSave: () => void;
}

const NewCandidateModal: React.FC<NewCandidateModalProps> = ({
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role_applied_for: "",
    status: "EM_PROCESSO",
    unit_id: null as number | null,
  });

  const [units, setUnits] = useState<Unit[]>([]);

  const api = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Pega a primeira etapa para o candidato
      const stagesResponse = await api.get("/api/recruitment/stages");
      const stages = stagesResponse.data;
      const firstStage = stages.length > 0 ? stages[0] : null;

      if (!firstStage) {
        toast.error("É necessário criar uma etapa primeiro");
        return;
      }

      const payload = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/\D/g, "") : null,
        stage_id: firstStage.id,
        user_id: null, // será definido no backend
      };

      await api.post("/api/recruitment/candidates", payload);

      toast.success("Candidato adicionado com sucesso!");
      onSave();
      onClose();
    } catch (error) {
      console.error("Erro ao adicionar candidato:", error);
      toast.error("Erro ao adicionar candidato");
    }
  };

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const res = await api.get("/api/units");
        setUnits(res.data || []);
        // se houver unidades e não foi selecionada, define a primeira
        if ((res.data || []).length > 0 && !formData.unit_id) {
          setFormData((prev) => ({ ...prev, unit_id: res.data[0].id }));
        }
      } catch (err) {
        console.error("Erro ao carregar unidades:", err);
      }
    };

    loadUnits();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          <IoCloseSharp />
        </button>

        <h2 className="modal-title">Novo Candidato</h2>

        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="name">Nome</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefone</label>
            <IMaskInput
              mask="(00) 00000-0000"
              id="phone"
              value={formData.phone}
              onAccept={(value: any) =>
                setFormData((prev) => ({ ...prev, phone: value }))
              }
              unmask={false}
              type="tel"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Cargo</label>
            <input
              type="text"
              id="role"
              value={formData.role_applied_for}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  role_applied_for: e.target.value,
                }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unidade</label>
            <select
              id="unit"
              value={formData.unit_id ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  unit_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="form-input"
              required
            >
              <option value="">Selecione a unidade</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="submit" className="form-button">
              Adicionar Candidato
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCandidateModal;
