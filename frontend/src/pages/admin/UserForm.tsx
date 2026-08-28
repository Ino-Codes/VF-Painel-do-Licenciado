import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import CorporatePhotoUploader from "./CorporatePhotoUploader.tsx";
import DatePicker from "../../components/forms/DatePicker.tsx";

interface User {
  id: number;
  nome: string;
  email: string;
  role?: string;
  group_id?: number | null;
  birth_date?: string | null;
  cargo?: string;
  setor?: string;
  setor_id?: number | null;
  corporate_photo_url?: string;
  data_admissao?: string | null;
}

interface AssignableGroup {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
}

interface Setor {
  id: number;
  nome: string;
}

const UserForm: React.FC<{
  userToEdit: User | null;
  formType: "licenciado" | "interno";
  onSuccess: (updatedUser?: User) => void;
  onCancel: () => void;
}> = ({ userToEdit, formType, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [groups, setGroups] = useState<AssignableGroup[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);

  // Carrega os grupos atribuíveis (para o formulário de colaborador interno).
  useEffect(() => {
    if (formType !== "interno") return;
    api
      .get("/api/groups/assignable")
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]));
  }, [formType]);

  // Carrega os setores (tabela normalizada) para o seletor.
  useEffect(() => {
    if (formType !== "interno") return;
    api
      .get("/api/setores")
      .then((res) => setSetores(res.data))
      .catch(() => setSetores([]));
  }, [formType]);

  useEffect(() => {
    if (userToEdit) {
      setFormData(userToEdit);
    } else {
      setFormData({
        nome: "",
        email: "",
        cargo: "",
        setor: "",
        setor_id: null,
        birth_date: "",
        data_admissao: "",
        group_id: null,
      });
    }
  }, [userToEdit, formType]);

  // Se o usuário tem setor (texto legado) mas não setor_id, tenta casar pelo
  // nome quando os setores carregarem.
  useEffect(() => {
    if (setores.length === 0) return;
    if (formData.setor_id) return;
    if (!formData.setor) return;

    const match = setores.find((s) => s.nome === formData.setor);
    if (match) {
      setFormData((prev) => ({ ...prev, setor_id: match.id }));
    }
  }, [setores]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSetorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const id = val ? Number(val) : null;
    const selected = setores.find((s) => s.id === id);
    setFormData((prev) => ({
      ...prev,
      setor_id: id,
      setor: selected ? selected.nome : "",
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
                <select
                  id="uf-setor"
                  name="setor_id"
                  value={formData.setor_id ?? ""}
                  onChange={handleSetorChange}
                  required
                  className="form-select"
                >
                  <option value="">Selecione o Setor</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="uf-group">Grupo de permissões</label>
                <select
                  id="uf-group"
                  name="group_id"
                  value={formData.group_id ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      group_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  required
                  className="form-select"
                >
                  <option value="">Selecione o Grupo</option>
                  {groups
                    .filter((g) => g.slug !== "licenciado")
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
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

      {/* --- FORMULÁRIO PARA V-PARTNERS --- */}
      {formType !== "interno" && (
        <div>
          <h3>{userToEdit ? "Editar V-Partner" : "Cadastrar Novo V-Partner"}</h3>
          <p className="userform-sub">
            {userToEdit
              ? `Atualize os dados de ${userToEdit.nome}.`
              : "Preencha os dados do novo V-Partner."}
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
