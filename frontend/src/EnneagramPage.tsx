// frontend/src/EnneagramPage.tsx
import React, { useState, useEffect } from "react";
import api from "./api.ts";
import { useNavigate } from "react-router-dom";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import toast from "react-hot-toast";

const EnneagramPage: React.FC = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/enneagram/questions").then((res) => setQuestions(res.data));
  }, []);

  const handleSelect = (questionId, chosenStatement, chosenType) => {
    setAnswers((prev) => ({ ...prev, [questionId]: chosenType }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      toast.error("Por favor, escolha uma opção para cada par de frases.");
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

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <h2>Teste de Perfil Eneagrama</h2>
        <p>
          Para cada par abaixo, selecione a frase que melhor o descreve na maior
          parte do tempo.
        </p>
        <div className="enneagram-form">
          {questions.map((q, index) => (
            <div key={q.id} className="enneagram-question-pair">
              <h4>Questão {index + 1}</h4>
              <div
                className={`statement-option ${
                  answers[q.id] === q.type_a ? "selected" : ""
                }`}
                onClick={() => handleSelect(q.id, "a", q.type_a)}
              >
                {q.statement_a}
              </div>
              <div className="separator-or">ou</div>
              <div
                className={`statement-option ${
                  answers[q.id] === q.type_b ? "selected" : ""
                }`}
                onClick={() => handleSelect(q.id, "b", q.type_b)}
              >
                {q.statement_b}
              </div>
            </div>
          ))}
          <button className="form-button" onClick={handleSubmit}>
            Ver Meu Resultado
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};
export default EnneagramPage;
