import React, { useState, useEffect, useCallback } from "react";
import { IMaskInput } from "react-imask";
import { useAuth } from "../../context/AuthContext.tsx";
import { useUnits } from "../../hooks/useUnits.ts";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import AvatarModal from "../../components/forms/AvatarModal.tsx";
import { HiOutlineUserCircle } from "react-icons/hi";
import { FiEdit, FiEye, FiCamera } from "react-icons/fi";
import { PiPencilSimpleLineBold } from "react-icons/pi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CertificateData {
  certificate_id: number;
  course_id: number;
  issue_date: string;
  course_title: string;
  company_slug?: string;
  company_name?: string;
}

interface User {
  id: number;
  email: string;
  nome: string;
  role: "admin" | "licenciado" | "colaborador";
  avatar_url?: string;
  cargo?: string;
  setor?: string;
  unit_id?: number;
  unidade_id?: number;
  unidade?: string;
  telefone?: string;
  data_admissao?: string;
  nickname?: string;
}

// ─── Mapa de nomes de empresa por slug (fallback caso o backend não retorne) ──

const COMPANY_NAMES: Record<string, string> = {
  "v-tax": "V-TAX",
  "v-banking": "V-BANKING",
  "v-business": "V-BUSINESS",
  "v-corp": "V-CORP",
  "v-tech": "V-TECH",
  "v-partner": "V-PARTNER",
};

// ─── Helper de formatação de telefone ────────────────────────────────────────

const formatarTelefone = (telefone?: string | null): string => {
  if (!telefone) return "Não informado";
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length !== 11) return telefone;
  return `(${digitos.substring(0, 2)}) ${digitos.substring(2, 7)}-${digitos.substring(7)}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Perfil: React.FC = () => {
  const { user, login, logout, loading, hasPermission } = useAuth() as {
    user: User | null;
    login: (u: any, t?: string) => void;
    logout: () => void;
    loading: boolean;
    hasPermission: (key: string) => boolean;
  };
  const { getUnitNameById, getUnitIdByName } = useUnits();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"info" | "certificates">("info");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: "",
    cargo: "",
    setor: "",
    unidade: "",
    telefone: "",
    nickname: "",
  });

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loading && user) {
      setEditForm({
        nome: user.nome || "",
        cargo: user.cargo || "",
        setor: user.setor || "",
        unidade: user.unidade || "",
        telefone: user.telefone || "",
        nickname: user.nickname || "",
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/");
      } else {
        setNome(user.nome);
      }
    }
  }, [user, loading, navigate]);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    setIsLoadingCertificates(true);
    try {
      const res = await api.get(`/api/certificates/user/${user.id}`);
      setCertificates(res.data);
    } catch (err) {
      toast.error("Não foi possível carregar os seus certificados.");
    } finally {
      setIsLoadingCertificates(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "certificates") {
      fetchCertificates();
    }
  }, [activeTab, fetchCertificates]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveChanges = async () => {
    if (!user) return;

    const nomeAtualizado = !hasPermission("internal_access")
      ? nome
      : editForm.nome;

    if (!nomeAtualizado.trim()) {
      toast.error("O nome não pode estar vazio.");
      return;
    }

    const payload: any = {
      ...user,
      nome: nomeAtualizado,
      data_admissao: user.data_admissao,
      nickname: editForm.nickname.trim() || null, // ADICIONADO
    };

    if (hasPermission("internal_access")) {
      const unitId = getUnitIdByName(editForm.unidade);
      payload.cargo = editForm.cargo;
      payload.setor = editForm.setor;
      payload.unidade = editForm.unidade;
      payload.unidade_id = unitId;
      payload.telefone = editForm.telefone.replace(/\D/g, "");
    }

    try {
      const res = await api.put(`/api/users/admin/${user.id}`, payload);
      login(res.data.user, res.data.token);
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    } catch (err: any) {
      const msg = err.response?.data?.error || "Erro ao salvar as alterações.";
      console.error("Erro 400 Detalhado:", msg);
      toast.error(msg);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (newPassword !== confirmPassword) {
      toast.error("A nova senha e a confirmação não correspondem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      await api.put(`/api/users/${user.id}/change-password`, {
        currentPassword,
        newPassword,
      });
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || "Erro ao alterar a senha.";
      toast.error(errorMessage);
      console.error(err);
    }
  };

  const handleConfirmRemoveAvatar = async () => {
    if (!user) return;
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil removida com sucesso!");
    } catch (err) {
      toast.error("Erro ao remover a foto.");
      console.error(err);
    } finally {
      setIsConfirmModalOpen(false);
    }
  };

  const handleViewCertificate = async (
    courseId: number,
    courseTitle: string,
  ) => {
    toast.loading("Preparando o seu certificado...");
    try {
      const response = await api.get(
        `/api/admin/courses/${courseId}/certificate`,
        { responseType: "blob" },
      );
      toast.dismiss();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `certificado-${courseTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.dismiss();
      toast.error("Não foi possível gerar o certificado. Tente novamente.");
      console.error("Erro ao gerar certificado:", err);
    }
  };

  // ─── Guards de render ─────────────────────────────────────────────────────

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        {/* ── Cabeçalho do perfil ── */}
        <div className="profile-header">
          <div className="profile-avatar-container">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Foto de Perfil"
                className="profile-avatar-main"
              />
            ) : (
              <HiOutlineUserCircle className="profile-avatar-main" />
            )}
            <button
              className="form-icon-photo camera"
              onClick={() => setIsAvatarModalOpen(true)}
            >
              <FiCamera />
            </button>
          </div>

          <div className="profile-actions">
            <div className="profile-header-info">
              <h2>{user.nome}</h2>
              <p>{user.email}</p>
            </div>
            <button
              className="botao-logout"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Desconectar
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            Informações Gerais
          </button>
          <button
            className={`tab-item ${activeTab === "certificates" ? "active" : ""}`}
            onClick={() => setActiveTab("certificates")}
          >
            Meus Certificados
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: Informações Gerais                                             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "info" && (
          <div className="profile-tab-content">
            {/* ── Informações do Perfil ── */}
            <div className="profile-section">
              <h3>
                Informações do Perfil
                {!isEditing && (
                  <button
                    className="form-icon-edit"
                    onClick={() => setIsEditing(true)}
                  >
                    <FiEdit /> Editar
                  </button>
                )}
              </h3>

              {!isEditing && (
                <div className="profile-info-grid">
                  <div className="info-item">
                    <span>Apelido</span>
                    <p>{user.nickname}</p>
                  </div>
                  <div className="info-item">
                    <span>Email</span>
                    <p>{user.email}</p>
                  </div>
                  {hasPermission("internal_access") && (
                    <div className="info-item">
                      <span>Cargo</span>
                      <p>{user.cargo || "Não informado"}</p>
                    </div>
                  )}
                  {hasPermission("internal_access") && (
                    <div className="info-item">
                      <span>Setor</span>
                      <p>{user.setor || "Não informado"}</p>
                    </div>
                  )}
                  {hasPermission("internal_access") && (
                    <div className="info-item">
                      <span>Unidade</span>
                      <p>
                        {getUnitNameById(user.unit_id) ||
                          user.unidade ||
                          "Não informado"}
                      </p>
                    </div>
                  )}
                  {hasPermission("internal_access") && (
                    <div className="info-item">
                      <span>Telefone</span>
                      <p>{formatarTelefone(user.telefone)}</p>
                    </div>
                  )}
                </div>
              )}

              {isEditing && (
                <div className="profile-edit-form">
                  <div className="form-row">
                    <label>Apelido:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.nickname}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nickname: e.target.value })
                      }
                    />
                  </div>

                  {hasPermission("internal_access") && (
                    <div className="form-row">
                      <label>Telefone:</label>
                      <IMaskInput
                        mask="(00) 00000-0000"
                        value={editForm.telefone}
                        onAccept={(value: any) =>
                          setEditForm({ ...editForm, telefone: value })
                        }
                        type="tel"
                        className="form-input"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      className="form-button-cancel"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </button>
                    <button className="form-button" onClick={handleSaveChanges}>
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Perfil Comportamental ── */}
            {hasPermission("internal_access") && (
              <div className="profile-section">
                <h3>Perfil Comportamental</h3>
                <p>
                  Realize este teste rápido e entenda melhor seus traços de
                  personalidade e como você interage em equipe.
                </p>
                <div className="profile-button-group">
                  <Link to="/enneagram">
                    <button className="form-icon-save">
                      <PiPencilSimpleLineBold /> Responder
                    </button>
                  </Link>
                  <Link to="/perfil/enneagram-results">
                    <button className="form-icon-list">
                      <FiEye /> Ver Resultado
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Alterar Senha ── */}
            <div className="profile-section">
              <h3>Alterar Senha</h3>

              <div className="form-row first">
                <label htmlFor="current-password">Senha Atual:</label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <label className="label-new-password" htmlFor="new-password">
                  Nova Senha:
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <label
                  className="label-new-password"
                  htmlFor="confirm-password"
                >
                  Confirmar Senha:
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <button className="form-button" onClick={handleChangePassword}>
                Alterar Senha
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: Meus Certificados                                              */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "certificates" && (
          <div className="profile-tab-content">
            {isLoadingCertificates ? (
              <LoadingSpinner />
            ) : (
              <div className="certificates-grid">
                {certificates.length > 0 ? (
                  certificates.map((cert) => {
                    // Slug da empresa — fallback para v-corp
                    const slug = cert.company_slug || "v-corp";

                    // Nome da empresa — vindo do backend ou fallback do mapa local
                    const companyName =
                      cert.company_name || COMPANY_NAMES[slug] || "V-CORP";

                    return (
                      <div
                        key={cert.certificate_id}
                        className={`certificate-card company-${slug}`}
                      >
                        <h4 className="certificate-title">
                          {cert.course_title}
                        </h4>

                        <p>{companyName}</p>

                        <p>
                          Emitido em:{" "}
                          {new Date(cert.issue_date).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>

                        <button
                          className="form-button"
                          onClick={() =>
                            handleViewCertificate(
                              cert.course_id,
                              cert.course_title,
                            )
                          }
                        >
                          Baixar Certificado
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    imageKey="certificado"
                    title="Nenhum Certificado Encontrado"
                    message="Você ainda não concluiu nenhum curso para obter um certificado. Complete um curso e ele aparecerá aqui!"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmRemoveAvatar}
        title="Remover Foto de Perfil"
        message="Tem certeza que deseja remover sua foto de perfil?"
      />

      <AvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
      />
    </div>
  );
};

export default Perfil;
