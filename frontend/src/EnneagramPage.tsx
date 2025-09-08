import React, { useState, useEffect } from "react";
import api from "./api.ts";
import { useNavigate } from "react-router-dom";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";
import LoadingSpinner from "./LoadingSpinner.tsx";

const QUESTIONS_PER_PAGE = 10;

const EnneagramPage: React.FC = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get("/api/enneagram/questions").then((res) => {
      setQuestions(res.data);
      setLoading(false);
    });
  }, []);

  const handleSelect = (questionId, chosenType) => {
    setAnswers((prev) => ({ ...prev, [questionId]: chosenType }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      toast.error("Por favor, responda a todas as perguntas.");
      return;
    }
    try {
      await api.post("/api/enneagram/submit", { answers });
      toast.success("Teste finalizado com sucesso!");
      navigate("/perfil/enneagram-results");
    } catch (err) {
      toast.error("Erro ao submeter o teste.");
    }
  };

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
  const endIndex = startIndex + QUESTIONS_PER_PAGE;
  const currentQuestions = questions.slice(startIndex, endIndex);

  const handleNextPage = () => {
    const answeredOnPage = currentQuestions.filter((q) =>
      answers.hasOwnProperty(q.id)
    ).length;
    if (answeredOnPage < currentQuestions.length) {
      toast.error(
        "Por favor, responda a todas as perguntas desta página para continuar."
      );
      return;
    }
    setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => prev - 1);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2>Teste de Perfil Eneagrama</h2>
          {totalPages > 0 && (
            <span style={{ fontWeight: 500, color: "#6c757d" }}>
              Página {currentPage} de {totalPages}
            </span>
          )}
        </div>
        <p>
          Para cada par abaixo, selecione a frase que melhor o descreve na maior
          parte do tempo.
        </p>
        <div className="enneagram-form">
          {currentQuestions.map((q, index) => (
            <div key={q.id} className="enneagram-question-pair">
              <h4>Questão {startIndex + index + 1}</h4>
              <div
                className={`statement-option ${
                  answers[q.id] === q.type_a ? "selected" : ""
                }`}
                onClick={() => handleSelect(q.id, q.type_a)}
              >
                {q.statement_a}
              </div>
              <div className="separator-or">ou</div>
              <div
                className={`statement-option ${
                  answers[q.id] === q.type_b ? "selected" : ""
                }`}
                onClick={() => handleSelect(q.id, q.type_b)}
              >
                {q.statement_b}
              </div>
            </div>
          ))}

          <div
            className="pagination-controls"
            style={{ borderTop: "none", paddingTop: "10px" }}
          >
            <button
              className="list-button"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              Anterior
            </button>

            {currentPage < totalPages ? (
              <button className="list-button" onClick={handleNextPage}>
                Próximo
              </button>
            ) : (
              <button className="list-button" onClick={handleSubmit}>
                Ver Meu Resultado
              </button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};
export default EnneagramPage;
