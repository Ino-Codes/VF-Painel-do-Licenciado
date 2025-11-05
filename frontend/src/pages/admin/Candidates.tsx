import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface Candidate {
  id: number;
  name: string;
  email: string;
  role_applied_for: string;
  stage_id: number;
}

interface Stage {
  id: number;
  name: string;
}

const Candidates: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role_applied_for: "",
    stage_id: 0,
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [cands, stagesRes] = await Promise.all([
        api.get("/recruitment/candidates"),
        api.get("/recruitment/stages"),
      ]);
      setCandidates(cands.data);
      setStages(stagesRes.data);
    } catch {
      toast.error("Erro ao carregar dados.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.stage_id) {
      toast.error("Nome e etapa são obrigatórios.");
      return;
    }

    try {
      if (editingId) {
        await api.put(`/recruitment/candidates/${editingId}`, form);
        toast.success("Candidato atualizado!");
      } else {
        await api.post("/recruitment/candidates", form);
        toast.success("Candidato adicionado!");
      }
      setForm({ name: "", email: "", role_applied_for: "", stage_id: 0 });
      setEditingId(null);
      fetchData();
    } catch {
      toast.error("Erro ao salvar candidato.");
    }
  };

  const handleEdit = (candidate: Candidate) => {
    setForm({
      name: candidate.name,
      email: candidate.email,
      role_applied_for: candidate.role_applied_for,
      stage_id: candidate.stage_id,
    });
    setEditingId(candidate.id);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Deseja realmente excluir este candidato?")) {
      await api.delete(`/recruitment/candidates/${id}`);
      fetchData();
    }
  };

  return (
    <div className="content-area">
      <h2>Gestão de Candidatos</h2>
      <p>Adicione, edite e organize candidatos do processo seletivo.</p>

      {/* Formulário */}
      <div
        className="admin-form"
        style={{ padding: "20px", marginTop: "20px" }}
      >
        <div className="form-row">
          <input
            className="form-input"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="form-input"
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="form-row">
          <input
            className="form-input"
            placeholder="Vaga"
            value={form.role_applied_for}
            onChange={(e) =>
              setForm({ ...form, role_applied_for: e.target.value })
            }
          />
          <select
            className="form-select"
            value={form.stage_id}
            onChange={(e) =>
              setForm({ ...form, stage_id: Number(e.target.value) })
            }
          >
            <option value={0}>Selecione uma etapa</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button className="form-button" onClick={handleSubmit}>
            {editingId ? "Salvar Alterações" : "Adicionar"}
          </button>
          {editingId && (
            <button
              className="form-button-cancel"
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: "",
                  email: "",
                  role_applied_for: "",
                  stage_id: 0,
                });
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <table className="admin-table" style={{ marginTop: "20px" }}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Vaga</th>
            <th>Etapa</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.email}</td>
              <td>{c.role_applied_for}</td>
              <td>{stages.find((s) => s.id === c.stage_id)?.name || "—"}</td>
              <td>
                <div className="user-actions">
                  <button className="list-button" onClick={() => handleEdit(c)}>
                    Editar
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDelete(c.id)}
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {candidates.length === 0 && (
        <div className="empty-state-container">
          <img
            src="https://cdn-icons-png.flaticon.com/512/4076/4076505.png"
            alt="Sem candidatos"
            className="empty-state-image"
          />
          <h3 className="empty-state-title">Nenhum candidato cadastrado</h3>
          <p className="empty-state-message">
            Adicione um candidato para começar o processo seletivo.
          </p>
        </div>
      )}
    </div>
  );
};

export default Candidates;
