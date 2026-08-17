import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import CorporatePhotoUploader from "./CorporatePhotoUploader.tsx";
import { useUnits } from "../../hooks/useUnits.ts";
import { Unit } from "../../types/recruitment.ts";
import DatePicker from "../../components/forms/DatePicker.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "comercial" | "rh" | "operacional";
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
  unidade?: string;
  unidade_id?: number | null;
  corporate_photo_url?: string;
  data_admissao?: string | null;
}

const UserForm: React.FC<{
  userToEdit: User | null;
  formType: "licenciado" | "interno";
  onSuccess: (updatedUser?: User) => void;
  onCancel: () => void;
}> = ({ userToEdit, formType, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const { units, loading } = useUnits();

  useEffect(() => {
    if (userToEdit) {
      setFormData(userToEdit);
    } else {
      setFormData({
        nome: "",
        email: "",
        unidade: "",
        unidade_id: null,
        cargo: "",
        setor: "",
        birth_date: "",
        data_admissao: "",
        role:
          formType === "licenciado" ? "licenciado" : "Selecione a Permissão",
      });
    }
  }, [userToEdit, formType]);

  // If the form has unidade (text) but not unidade_id, try to map it after units load
  useEffect(() => {
    if (units.length === 0) return;
    if (formData.unidade_id) return;
    if (!formData.unidade) return;

    const match = units.find((u) => u.name === formData.unidade);
    if (match) {
      setFormData((prev) => ({ ...prev, unidade_id: match.id }));
    }
  }, [units]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const id = val ? Number(val) : null;
    const selected = units.find((u) => u.id === id);
    setFormData((prev) => ({
      ...prev,
      unidade_id: id,
      unidade: selected ? selected.name : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (userToEdit) {
        const response = await api.put(
          `/api/users/admin/${userToEdit.id}`,
          formData,
        );
        toast.success("Usuário atualizado com sucesso!");
        onSuccess(response.data.user); // Passa o usuário atualizado para o componente pai
      } else {
        await api.post("/api/users/admin", formData);
        toast.success("Usuário criado com sucesso!");
        onSuccess(); // Para criação, apenas aciona a atualização da lista
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Ocorreu um erro.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form userform">
      {/* --- FORMULÁRIO PARA COLABORADORES --- */}
      {formType === "interno" && (
        <div>
          <h3>{userToEdit ? "Editar Colaborador" : "Cadastrar Novo Colaborador"}</h3>
          <p className="userform-sub">
            {userToEdit
              ? `Atualize os dados de ${userToEdit.nome}.`
              : "Preencha os dados do novo colaborador."}
          </p>

          {/* Identificação */}
          <div className="userform-section">
            <span className="userform-section-title">Identificação</span>

            {userToEdit && (
              <CorporatePhotoUploader
                user={userToEdit}
                onUploadSuccess={onSuccess}
              />
            )}

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="uf-nome">Nome completo</label>
                <input
                  id="uf-nome"
                  name="nome"
                  value={formData.nome || ""}
                  onChange={handleChange}
                  placeholder="Nome completo"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label htmlFor="uf-email">E-mail</label>
                <input
                  id="uf-email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleChange}
                  placeholder="email@empresa.com"
                  type="email"
                  required
                  className="form-input"
                />
              </div>
              {!userToEdit && (
                <div className="form-field">
                  <label htmlFor="uf-senha">Senha inicial</label>
                  <input
                    id="uf-senha"
                    name="password"
                    onChange={handleChange}
                    placeholder="Defina uma senha"
                    type="password"
                    required
                    className="form-input"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dados profissionais */}
          <div className="userform-section">
            <span className="userform-section-title">Dados profissionais</span>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="uf-cargo">Cargo</label>
                <input
                  id="uf-cargo"
                  name="cargo"
                  value={formData.cargo || ""}
                  onChange={handleChange}
                  placeholder="Cargo"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label htmlFor="uf-setor">Setor</label>
                <input
                  id="uf-setor"
                  name="setor"
                  value={formData.setor || ""}
                  onChange={handleChange}
                  placeholder="Setor"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label htmlFor="uf-unidade">Unidade</label>
                <select
                  id="uf-unidade"
                  name="unidade_id"
                  value={formData.unidade_id ?? ""}
                  onChange={handleUnitChange}
                  required
                  className="form-select"
                  disabled={loading}
                >
                  <option value="">
                    {loading ? "Carregando..." : "Selecione a Unidade"}
                  </option>
                  {!loading &&
                    units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                </select>
              </div>
              {userToEdit?.role !== "licenciado" && (
                <div className="form-field">
                  <label htmlFor="uf-role">Permissão</label>
                  <select
                    id="uf-role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">
                      {loading ? "Carregando..." : "Selecione a Permissão"}
                    </option>
                    <option value="comercial">Comercial</option>
                    <option value="rh">RH</option>
                    <option value="operacional">Operacional</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Datas */}
          <div className="userform-section">
            <span className="userform-section-title">Datas</span>
            <div className="form-grid">
              <div className="form-field">
                <label>Data de Nascimento</label>
                <DatePicker
                  value={
                    formData.birth_date
                      ? formData.birth_date.substring(0, 10)
                      : ""
                  }
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, birth_date: date }))
                  }
                  includeWeekends={true}
                />
              </div>
              <div className="form-field">
                <label>Data de Admissão</label>
                <DatePicker
                  value={
                    formData.data_admissao
                      ? formData.data_admissao.substring(0, 10)
                      : ""
                  }
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, data_admissao: date }))
                  }
                  includeWeekends={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULÁRIO PARA LICENCIADOS --- */}
      {formType !== "interno" && (
        <div>
          <h3>{userToEdit ? "Editar Licenciado" : "Cadastrar Novo Licenciado"}</h3>
          <p className="userform-sub">
            {userToEdit
              ? `Atualize os dados de ${userToEdit.nome}.`
              : "Preencha os dados do novo licenciado."}
          </p>

          <div className="userform-section">
            <span className="userform-section-title">Identificação</span>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="uf-l-nome">Nome completo</label>
                <input
                  id="uf-l-nome"
                  name="nome"
                  value={formData.nome || ""}
                  onChange={handleChange}
                  placeholder="Nome completo"
                  required
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label htmlFor="uf-l-email">E-mail</label>
                <input
                  id="uf-l-email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleChange}
                  placeholder="email@empresa.com"
                  type="email"
                  required
                  className="form-input"
                />
              </div>
              {!userToEdit && (
                <div className="form-field">
                  <label htmlFor="uf-l-senha">Senha inicial</label>
                  <input
                    id="uf-l-senha"
                    name="password"
                    onChange={handleChange}
                    placeholder="Defina uma senha"
                    type="password"
                    required
                    className="form-input"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" onClick={onCancel} className="form-button-cancel">
          Cancelar
        </button>
        <button type="submit" className="form-button">
          {userToEdit ? "Salvar Alterações" : "Criar Usuário"}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
