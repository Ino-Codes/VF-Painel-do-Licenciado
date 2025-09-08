import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import FaqModal from "./FaqModal.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import { useNavigate } from "react-router-dom";
import EmptyState from "./EmptyState.tsx";
import EmptyFaqImage from "./assets/images/empty_faq.svg";

interface FaqData {
  id: number;
  category: string;
  question: string;
  answer: string;
  document_url?: string;
  document_originalname?: string;
}

const Faq: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [faqs, setFaqs] = useState<FaqData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/api/faq/categories");
      setCategories(res.data);
    } catch (err) {
      toast.error("Erro ao buscar categorias.");
    }
  }, []);

  const fetchFaqs = useCallback(async () => {
    try {
      const params: any = { page: currentPage, limit: 15 };
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get("/api/faq", { params });
      setFaqs(res.data.faqs);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error("Erro ao buscar FAQs.");
    }
  }, [currentPage, selectedCategory, searchQuery]);

  useEffect(() => {
    if (!loading && !user) navigate("/");
    if (user) {
      fetchCategories();
    }
  }, [user, loading, navigate, fetchCategories]);

  useEffect(() => {
    if (user) {
      fetchFaqs();
    }
  }, [user, fetchFaqs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const handleSearch = () => setSearchQuery(searchTerm);

  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/api/faq/admin/${itemToDelete}`);
      toast.success("Item excluído com sucesso!");
      fetchFaqs();
      fetchCategories();
    } catch (err) {
      toast.error("Erro ao excluir item.");
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const toggleAccordion = (id: number) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const baseURL = api.defaults.baseURL;

  if (loading) return <div className="tela-loading">Carregando...</div>;
  if (!user) return null;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area document-center">
        <div className="document-header">
          <h2>Perguntas Frequentes (FAQ)</h2>
          {user.role === "admin" && (
            <button
              className="form-button"
              onClick={() => setIsModalOpen(true)}
            >
              + Adicionar Pergunta
            </button>
          )}
        </div>

        <div className="tabs">
          <button
            className={`tab-item ${!selectedCategory ? "active" : ""}`}
            onClick={() => setSelectedCategory(null)}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab-item ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <input
            type="search"
            placeholder="Pesquisar por assunto..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="form-button" onClick={handleSearch}>
            Pesquisar
          </button>
        </div>

        <div className="faq-list">
          {!loading && faqs.length > 0 ? (
            faqs.map((faq) => (
              <div key={faq.id} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => toggleAccordion(faq.id)}
                >
                  <span>{faq.question}</span>
                  <span className="faq-toggle">
                    {activeAccordion === faq.id ? "-" : "+"}
                  </span>
                </button>
                {activeAccordion === faq.id && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                    {faq.document_url && (
                      <a
                        href={`${baseURL}/api/faq/download/${faq.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="faq-document-link"
                      >
                        Baixar Documento: {faq.document_originalname}
                      </a>
                    )}
                    {user.role === "admin" && (
                      <div className="faq-actions">
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteClick(faq.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              image={EmptyFaqImage}
              title="Nenhuma Pergunta Encontrada"
              message="Estamos incluindo perguntas e respostas ao FAQ. Caso não tenha encontrado resultados para sua busca, tente novamente mais tarde."
            ></EmptyState>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div>
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="list-button"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="list-button"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
      {isModalOpen && (
        <FaqModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchFaqs();
            fetchCategories();
          }}
        />
      )}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta pergunta?"
      />
      <Footer />
    </div>
  );
};

export default Faq;
