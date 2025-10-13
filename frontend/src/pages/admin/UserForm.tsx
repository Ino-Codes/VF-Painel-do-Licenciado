import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import CorporatePhotoUploader from "./CorporatePhotoUploader.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "colaborador";
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
  unidade?: string;
  corporate_photo_url?: string;
}

const Unidades = ["Matriz", "Filial SC", "Filial SP"];

const UserForm: React.FC<{
  userToEdit: User | null;
  formType: "licenciado" | "interno";
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ userToEdit, formType, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Partial<User>>({});

  useEffect(() => {
    if (userToEdit) {
      setFormData(userToEdit);
    } else {
      setFormData({
        nome: "",
        email: "",
        unidade: "",
        cargo: "",
        setor: "",
        birth_date: "",
        role: formType === "licenciado" ? "licenciado" : "colaborador",
      });
    }
  }, [userToEdit, formType]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (userToEdit) {
        await api.put(`/api/users/admin/${userToEdit.id}`, formData);
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await api.post("/api/users/admin", formData);
        toast.success("Usuário criado com sucesso!");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Ocorreu um erro.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <h3>
        {userToEdit ? `Editando: ${userToEdit.nome}` : `Criar Novo Usuário`}
      </h3>
      <div className="form-row">
        <input
          name="nome"
          value={formData.nome || ""}
          onChange={handleChange}
          placeholder="Nome Completo"
          required
          className="form-input"
        />
        <input
          name="email"
          value={formData.email || ""}
          onChange={handleChange}
          placeholder="Email"
          type="email"
          required
          className="form-input"
        />
      </div>
      {!userToEdit && (
        <div className="form-row">
          <input
            name="password"
            onChange={handleChange}
            placeholder="Senha"
            type="password"
            required
            className="form-input"
          />
        </div>
      )}
      {formType === "interno" && (
        <div>
          <div className="form-row">
            <input
              name="cargo"
              value={formData.cargo || ""}
              onChange={handleChange}
              placeholder="Cargo"
              required
              className="form-input"
            />
            <input
              name="setor"
              value={formData.setor || ""}
              onChange={handleChange}
              placeholder="Setor"
              required
              className="form-input"
            />
          </div>
          <div className="form-row">
            <select
              name="unidade"
              value={formData.unidade || ""}
              onChange={handleChange}
              required
              className="form-select"
            >
              <option value="" disabled>
                Selecione a Unidade
              </option>
              {Unidades.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {userToEdit?.role !== "licenciado" && (
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="form-select"
              >
                <option value="colaborador">Colaborador</option>
                <option value="admin">Admin</option>
              </select>
            )}
          </div>
          <div className="form-row">
            <label className="label-birth-day">Data de Nascimento</label>
            <input
              name="birth_date"
              value={
                formData.birth_date ? formData.birth_date.substring(0, 10) : ""
              }
              onChange={handleChange}
              type="date"
              required
              className="form-input"
            />
          </div>

          {userToEdit && (
            <CorporatePhotoUploader
              user={userToEdit}
              onUploadSuccess={onSuccess}
            />
          )}
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
