import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";
import EmptyState from "./EmptyState.tsx";
import AvatarModal from "./AvatarModal.tsx";
import EmptyCertificadoImage from "./assets/images/empty_certificado.svg";

interface CertificateData {
  certificate_id: number;
  course_id: number;
  issue_date: string;
  course_title: string;
}

interface User {
  id: number;
  email: string;
  nome: string;
  role: "admin" | "licenciado" | "colaborador";
  avatar_url?: string;
  cargo?: string;
  setor?: string;
}

const Perfil: React.FC = () => {
  const { user, login, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"info" | "certificates">("info");

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [nome, setNome] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  });

  useEffect(() => {
    if (!loading && user) {
      setEditForm({
        nome: user.nome || "",
        cargo: user.cargo || "",
        setor: user.setor || "",
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    const formData = new FormData();
    formData.append("avatar", selectedFile);
    try {
      const res = await api.post(`/api/users/${user.id}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedUser = { ...user, avatar_url: res.data.avatarUrl };
      login(updatedUser);
      toast.success("Foto de perfil atualizada com sucesso!");
      setSelectedFile(null);
    } catch (err) {
      toast.error("Erro ao atualizar a foto.");
      console.error(err);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !nome.trim()) {
      toast.error("O nome não pode estar vazio.");
      return;
    }
    try {
      const res = await api.put(`/api/users/admin/${user.id}`, {
        ...user,
        nome: editForm.nome,
        cargo: editForm.cargo,
        setor: editForm.setor,
      });
      login(res.data.user);
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    } catch (err) {
      toast.error("Erro ao salvar as alterações.");
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

  const handleRemoveAvatarClick = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRemoveAvatar = async () => {
    if (!user) return;
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user);
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
    courseTitle: string
  ) => {
    toast.loading("Preparando o seu certificado...");
    try {
      const response = await api.get(
        `/api/admin/courses/${courseId}/certificate`,
        {
          ...getAuthHeaders(),
          responseType: "blob",
        }
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

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="profile-header">
          <div className="profile-avatar-container">
            <img
              src={
                user.avatar_url ||
                "https://res.cloudinary.com/dsgbgrll5/image/upload/v1754077476/imagem-do-usuario-com-fundo-preto_kcuzbg.png"
              }
              alt="Foto de Perfil"
              className="profile-avatar-main"
            />
            <button
              className="profile-edit-icon"
              onClick={() => setIsAvatarModalOpen(true)}
            >
              ✏️
            </button>
          </div>

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

        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            Informações Gerais
          </button>
          <button
            className={`tab-item ${
              activeTab === "certificates" ? "active" : ""
            }`}
            onClick={() => setActiveTab("certificates")}
          >
            Meus Certificados
          </button>
        </div>

        {activeTab === "info" && (
          <div className="profile-tab-content">
            {user.role !== "licenciado" && (
              <div className="profile-section">
                <h3>
                  Informações do Perfil
                  <button
                    className="edit-profile-button"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Editar
                  </button>
                </h3>

                {!isEditing && (
                  <div className="profile-info-grid">
                    <div className="info-item">
                      <span>Nome</span>
                      <p>{user.nome}</p>
                    </div>
                    <div className="info-item">
                      <span>Email</span>
                      <p>{user.email}</p>
                    </div>
                    <div className="info-item">
                      <span>Cargo</span>
                      <p>{user.cargo || "Não informado"}</p>
                    </div>
                    <div className="info-item">
                      <span>Setor</span>
                      <p>{user.setor || "Não informado"}</p>
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="profile-edit-form">
                    <div className="form-row">
                      <label>Nome:</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.nome}
                        onChange={(e) =>
                          setEditForm({ ...editForm, nome: e.target.value })
                        }
                      />
                    </div>

                    {user.role === "admin" && (
                      <div className="form-row">
                        <label>Cargo:</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.cargo}
                          onChange={(e) =>
                            setEditForm({ ...editForm, cargo: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {user.role === "admin" && (
                      <div className="form-row">
                        <label>Setor:</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.setor}
                          onChange={(e) =>
                            setEditForm({ ...editForm, setor: e.target.value })
                          }
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
                      <button
                        className="form-button"
                        onClick={handleSaveChanges}
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {user.role !== "licenciado" && (
              <div className="profile-section">
                <h3>Perfil Comportamental</h3>
                <p>
                  Entenda melhor seus traços de personalidade e como você
                  interage em equipe.
                </p>
                <div className="profile-button-group">
                  <Link to="/enneagram" className="form-button">
                    Fazer Teste Eneagrama
                  </Link>
                  <Link
                    to="/perfil/enneagram-results"
                    className="form-button-cancel"
                  >
                    Ver Resultado
                  </Link>
                </div>
              </div>
            )}

            {user.role === "licenciado" && (
              <div className="other-section">
                <h3>Editar Informações</h3>
                <div className="form-row">
                  <label htmlFor="nome">Nome:</label>
                  <input
                    id="nome"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="form-input"
                  />
                </div>

                <button className="form-button" onClick={handleSaveChanges}>
                  Salvar Alterações
                </button>
              </div>
            )}

            <div className="other-section">
              <h3>Alterar Senha</h3>
              <div className="form-row">
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
                <label htmlFor="new-password">Nova Senha:</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <label htmlFor="confirm-password">Confirmar Senha:</label>
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

        {activeTab === "certificates" && (
          <div className="profile-tab-content">
            {isLoadingCertificates ? (
              <LoadingSpinner />
            ) : (
              <div className="certificates-grid">
                {certificates.length > 0 ? (
                  certificates.map((cert) => (
                    <div key={cert.certificate_id} className="certificate-card">
                      <h4>{cert.course_title}</h4>
                      <p>
                        Emitido em:{" "}
                        {new Date(cert.issue_date).toLocaleDateString("pt-BR")}
                      </p>
                      <button
                        className="form-button"
                        id="form-button-certificate"
                        onClick={() =>
                          handleViewCertificate(
                            cert.course_id,
                            cert.course_title
                          )
                        }
                      >
                        Visualizar Certificado
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    image={EmptyCertificadoImage}
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
