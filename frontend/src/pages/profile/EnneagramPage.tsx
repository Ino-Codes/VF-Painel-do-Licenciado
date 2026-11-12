import React, { useState, useEffect, useRef } from "react";
import api from "../../api.ts";
import { useNavigate } from "react-router-dom";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import { AnimatePresence, motion } from "motion/react";
import { ENTRADA, reduzMovimento } from "../../utils/animacao.ts";

const QUESTIONS_PER_PAGE = 10;

// Troca de página: as perguntas saem para um lado e as novas entram pelo
// outro, no sentido em que a pessoa andou (próxima ou anterior).
const PAGINA = {
  entra: (sentido: number) => ({ opacity: 0, x: sentido * 48 }),
  centro: { opacity: 1, x: 0, transition: { duration: 0.28, ease: ENTRADA } },
  sai: (sentido: number) => ({ opacity: 0, x: sentido * -48, transition: { duration: 0.16 } }),
};

const EnneagramPage: React.FC = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  // 1 = avançou, -1 = voltou: define o lado da animação.
  const [sentido, setSentido] = useState(1);
  const topoRef = useRef<HTMLDivElement>(null);

  // A página nova começa do topo: quem clicou em "Próximo" estava no fim.
  useEffect(() => {
    const topo = topoRef.current;
    if (!topo || topo.getBoundingClientRect().top >= 0) return;
    topo.scrollIntoView({ behavior: reduzMovimento() ? "auto" : "smooth", block: "start" });
  }, [currentPage]);

  useEffect(() => {
    api
      .get("/api/enneagram/questions")
      .then((res) => {
        setQuestions(res.data);
      })
      .catch((err) => {
        console.error("Erro ao carregar perguntas do eneagrama:", err);
        toast.error("Não foi possível carregar o teste. Tente novamente.");
      })
      .finally(() => setLoading(false));
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
    setSentido(1);
    setCurrentPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    setSentido(-1);
    setCurrentPage((prev) => prev - 1);
  };

  const respondidas = Object.keys(answers).length;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="enneagram-page-header" ref={topoRef}>
          <h2>Teste de Perfil Eneagrama</h2>
          {totalPages > 0 && (
            <span className="enneagram-page-indicator">
              Página {currentPage} de {totalPages}
            </span>
          )}
        </div>
        <p>
          Para cada par abaixo, selecione a frase que melhor o descreve na maior
          parte do tempo.
        </p>
        {questions.length > 0 && (
          <div className="enneagram-progresso">
            <div
              className="enneagram-progresso-trilho"
              role="progressbar"
              aria-label="Perguntas respondidas"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={respondidas}
            >
              <motion.span
                className="enneagram-progresso-barra"
                initial={false}
                animate={{ scaleX: respondidas / questions.length }}
                transition={{ duration: 0.4, ease: ENTRADA }}
              />
            </div>
            <span className="enneagram-progresso-texto">
              {respondidas} de {questions.length} respondidas
            </span>
          </div>
        )}
        <div className="enneagram-form">
          <AnimatePresence mode="wait" initial={false} custom={sentido}>
            <motion.div
              key={currentPage}
              custom={sentido}
              variants={PAGINA}
              initial="entra"
              animate="centro"
              exit="sai"
            >
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
            </motion.div>
          </AnimatePresence>

          <div className="pagination-controls enneagram-pagination">
            <button
              className="list-button"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              Anterior
            </button>

            {totalPages > 0 && (
              <span className="enneagram-page-indicator">
                Página {currentPage} de {totalPages}
              </span>
            )}

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
