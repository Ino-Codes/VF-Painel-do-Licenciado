import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FaqModal from "../../components/forms/FaqModal.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import { useNavigate } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";

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

  const [company, setCompany] = useState<string>("all");

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
      const res = await api.get("/api/faq/categories", {
        params: { company },
      });
      setCategories(res.data);
    } catch (err: any) {
      // 404 = empresa não encontrada no banco (slug ainda não migrado) — não exibir erro
      if (err?.response?.status !== 404) {
        toast.error("Erro ao buscar categorias.");
      }
      setCategories([]);
    }
  }, [company]);

  const fetchFaqs = useCallback(async () => {
    try {
      const params: any = {
        page: currentPage,
        limit: 10,
        company,
        _t: new Date().getTime(),
      };

      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get("/api/faq", { params });
      setFaqs(res.data.faqs ?? []);
      setTotalPages(res.data.totalPages ?? 0);
    } catch (err: any) {
      // 404 = empresa não encontrada no banco (slug ainda não migrado) — não exibir erro
      if (err?.response?.status !== 404) {
        toast.error("Erro ao buscar FAQs.");
      }
      setFaqs([]);
      setTotalPages(0);
    }
  }, [currentPage, selectedCategory, searchQuery, company]);

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
  }, [selectedCategory, searchQuery, company]);

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
      <div className={`content-area document-center company-${company}`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">Perguntas Frequentes (FAQ)</h2>
          </div>

          {user.role === "admin" && (
            <button
              className="form-button form-button--add"
              onClick={() => setIsModalOpen(true)}
            >
              + Adicionar Pergunta
            </button>
          )}
        </div>

        <CompanyFilter value={company} onChange={setCompany} />

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
              imageKey="faq"
              title="Nenhuma Pergunta Encontrada"
              message="Nosso FAQ está crescendo! Estamos adicionando novas perguntas e respostas para deixar tudo claro para você. Se não encontrou o que precisava agora, volte logo — a resposta que você busca pode estar a caminho!"
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
