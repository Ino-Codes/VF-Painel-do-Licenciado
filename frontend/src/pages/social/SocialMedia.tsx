import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import SocialPostModal from "../../components/forms/SocialPostModal.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";
import { FiTrash2, FiCopy, FiImage, FiDownload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const SocialMedia: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<string>("all");

  // Estados para dados e interface
  const [groupedPosts, setGroupedPosts] = useState<any>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleDeleteClick = (postId: number) => {
    setPostToDelete(postId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (postToDelete === null) return;
    toast.loading("Excluindo conteúdo...");
    try {
      await api.delete(`/api/social/${postToDelete}`);

      toast.dismiss();
      toast.success("Conteúdo excluído com sucesso!");

      await fetchSocialContent();
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao excluir o conteúdo.");
      console.error(err);
    } finally {
      setIsConfirmModalOpen(false);
      setPostToDelete(null);
    }
  };

  const handleDownload = async (postId: number, postTitle: string) => {
    toast.loading("Preparando arquivos...");
    try {
      const res = await api.get(`/api/social/download/${postId}`);
      const { downloadUrl } = res.data;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", postTitle);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss();
      toast.success("Download iniciado!");
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao processar download.");
    }
  };

  const handleCopyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Legenda copiada para a área de transferência!");
  };

  // Função para buscar posts e extrair categorias únicas
  const fetchSocialContent = useCallback(async () => {
    if (!user) return;
    try {
      // Passa a empresa selecionada como filtro
      const res = await api.get("/api/social", {
        params: { company },
      });
      setGroupedPosts(res.data);

      const uniqueCategories = Object.keys(res.data);
      setCategories(uniqueCategories);

      // Controle inteligente da aba ativa ao trocar de empresa. Usa update
      // funcional para não depender de `activeCategory` (evita que a busca seja
      // refeita no servidor só por trocar de aba).
      setActiveCategory((prev) => {
        if (uniqueCategories.length === 0) return "";
        return prev && uniqueCategories.includes(prev)
          ? prev
          : uniqueCategories[0];
      });
    } catch (err) {
      toast.error("Erro ao carregar conteúdos das redes sociais.");
    }
  }, [user, company]);

  // Refaz a busca sempre que a empresa mudar
  useEffect(() => {
    if (user) fetchSocialContent();
  }, [user, fetchSocialContent]);

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchSocialContent();
  };

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  return (
    <div className="p-2">
      <Menu />
      <div className={`content-area document-center company-${company}`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">Conteúdos para Redes Sociais</h2>
          </div>

          {hasPermission("social.manage") && (
            <button
              className="form-button form-button--add"
              onClick={() => setIsModalOpen(true)}
            >
              + Novo Conteúdo
            </button>
          )}
        </div>

        <CompanyFilter value={company} onChange={setCompany} />

        {/* Tabs de Categoria */}
        {categories.length > 0 && (
          <div className="tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`tab-item ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Grid de Conteúdo */}
        <div className="video-list">
          {groupedPosts[activeCategory]?.length > 0 ? (
            groupedPosts[activeCategory].map((post: any) => (
              <div key={post.id} className="social-post-card">
                <div className="social-post-image-container">
                  {post.images?.length > 0 && (
                    <>
                      <img
                        src={post.images[0]}
                        alt={post.title}
                        className="social-post-main-image"
                      />
                      {post.images.length > 1 && (
                        <div className="social-post-badge">
                          <FiImage /> <span>+{post.images.length - 1}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="social-post-content">
                  <div className="social-post-header">
                    <div className="social-post-title-group">
                      <h3>{post.title}</h3>
                      <div className="social-post-tags">
                        <span className="social-post-category-tag">
                          {post.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="social-post-caption">{post.caption}</p>

                  <div className="social-post-footer">
                    <div className="social-post-actions">
                      <button
                        className="form-icon-save"
                        onClick={() => handleCopyCaption(post.caption)}
                        title="Copiar Legenda"
                      >
                        <FiCopy /> Legenda
                      </button>

                      <button
                        className="form-icon-save"
                        onClick={() => handleDownload(post.id, post.title)}
                        title="Baixar Imagens"
                      >
                        <FiDownload /> Imagens
                      </button>
                    </div>

                    {hasPermission("social.manage") && (
                      <button
                        className="form-icon-delete"
                        onClick={() => handleDeleteClick(post.id)}
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              imageKey="documentos"
              title="Nenhum post encontrado"
              message="Nenhum conteúdo foi publicado nesta categoria."
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <SocialPostModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
          categories={
            categories.length > 0
              ? categories
              : ["Instagram", "LinkedIn", "WhatsApp"]
          }
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este post? Todas as imagens serão removidas permanentemente."
      />

      <Footer />
    </div>
  );
};

export default SocialMedia;
