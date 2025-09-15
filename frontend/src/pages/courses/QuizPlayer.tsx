import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from ".../api.ts";
import { useAuth } from ".../context/AuthContext.tsx";
import Menu from ".../components/layout/Menu.tsx";
import Footer from ".../components/layout/Footer.tsx";
import LoadingSpinner from ".../components/ui/LoadingSpinner.tsx";
import toast from "react-hot-toast";

interface QuizOption {
  id: number;
  option_text: string;
}
interface QuizQuestion {
  id: number;
  question_text: string;
  options: QuizOption[];
}
interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
}
interface QuizResult {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
}

const QuizPlayer: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: number]: number;
  }>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchQuiz = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/quizzes/course/${courseId}`);
      setQuiz(res.data);
    } catch (error) {
      toast.error("Não foi possível carregar o quiz.");
      navigate(`/courses/${courseId}`);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, user, navigate]);

  useEffect(() => {
    if (user) fetchQuiz();
  }, [user, fetchQuiz]);

  const handleAnswerChange = (questionId: number, optionId: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (
      !quiz ||
      Object.keys(selectedAnswers).length !== quiz.questions.length
    ) {
      toast.error("Por favor, responda a todas as perguntas.");
      return;
    }
    try {
      const res = await api.post(
        `/api/quizzes/${quiz.id}/submit`,
        {
          userId: user?.id,
          answers: selectedAnswers,
        },
        getAuthHeaders()
      );

      setQuizResult(res.data);
    } catch (error) {
      toast.error("Erro ao submeter o quiz.");
    }
  };

  if (loading || isLoading) return <LoadingSpinner />;

  if (quizResult) {
    return (
      <div className="p-2">
        <Menu />
        <div className="content-area quiz-results">
          <h2>Resultado do Teste</h2>
          {quizResult.passed ? (
            <div className="result-pass">
              <h3>Parabéns, você foi aprovado! 🎉</h3>
              <p>Sua nota: {quizResult.score}%</p>
              <p>
                Você acertou {quizResult.correctAnswers} de{" "}
                {quizResult.totalQuestions} perguntas.
              </p>
            </div>
          ) : (
            <div className="result-fail">
              <h3>Não foi desta vez...</h3>
              <p>Sua nota: {quizResult.score}%</p>
              <p>
                Você acertou {quizResult.correctAnswers} de{" "}
                {quizResult.totalQuestions} perguntas. Estude mais um pouco e
                tente novamente!
              </p>
            </div>
          )}
          <button
            className="form-button"
            onClick={() => navigate(`/courses/${courseId}`)}
          >
            Voltar para o Curso
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>{quiz?.title || "Teste de Conhecimento"}</h2>
        <div className="quiz-container">
          {quiz?.questions.map((q, index) => (
            <div key={q.id} className="quiz-question">
              <h4>
                {index + 1}. {q.question_text}
              </h4>
              <div className="quiz-options">
                {q.options.map((o) => (
                  <label key={o.id} className="quiz-option-label">
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={o.id}
                      checked={selectedAnswers[q.id] === o.id}
                      onChange={() => handleAnswerChange(q.id, o.id)}
                    />
                    {o.option_text}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="form-button" onClick={handleSubmit}>
            Finalizar e Enviar Respostas
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default QuizPlayer;
