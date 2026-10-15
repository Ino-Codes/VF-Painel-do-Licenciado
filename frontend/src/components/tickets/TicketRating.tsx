import React, { useEffect, useRef, useState } from "react";
import { FaStar, FaRegStar } from "react-icons/fa";
import { FiAlertCircle } from "react-icons/fi";

// Avaliação do atendimento de um chamado concluído: 1 a 5 estrelas e
// comentário opcional. Uma por chamado, sem edição — depois de enviada, só
// é exibida.

export interface AvaliacaoChamado {
  nota: number;
  comentario: string | null;
  data: string;
}

export const ROTULOS_NOTA = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];
const MAX_COMENTARIO = 1000;

/** Estrelas só de leitura (cartões e detalhes). */
export const Estrelas: React.FC<{ nota: number; className?: string }> = ({
  nota,
  className,
}) => (
  <span
    className={`rating-stars${className ? ` ${className}` : ""}`}
    role="img"
    aria-label={`${nota} de 5 estrelas`}
  >
    {[1, 2, 3, 4, 5].map((n) =>
      n <= nota ? (
        <FaStar key={n} className="rating-star rating-star--on" aria-hidden="true" />
      ) : (
        <FaRegStar key={n} className="rating-star" aria-hidden="true" />
      ),
    )}
  </span>
);

interface Props {
  avaliacao: AvaliacaoChamado | null | undefined;
  /** Envia a avaliação. Ausente = quem está vendo não pode avaliar aqui. */
  onAvaliar?: (nota: number, comentario: string) => Promise<void>;
  /** Nota pré-selecionada (estrela clicada no e-mail). */
  notaInicial?: number;
  /** Rola até a avaliação ao abrir (link "#avaliar"). */
  focar?: boolean;
}

const TicketRating: React.FC<Props> = ({ avaliacao, onAvaliar, notaInicial, focar }) => {
  const [nota, setNota] = useState(
    notaInicial && notaInicial >= 1 && notaInicial <= 5 ? notaInicial : 0,
  );
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const blocoRef = useRef<HTMLDivElement>(null);
  const estrelasRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focar && blocoRef.current) {
      blocoRef.current.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [focar]);

  // ── Já avaliado: só mostra ──
  if (avaliacao) {
    return (
      <div className="rating-block rating-block--done" id="avaliar" ref={blocoRef}>
        <span className="chamado-field-label">Sua avaliação do atendimento</span>
        <div className="rating-done-row">
          <Estrelas nota={avaliacao.nota} />
          <span className="rating-label">{ROTULOS_NOTA[avaliacao.nota]}</span>
        </div>
        {avaliacao.comentario && <p className="rating-comment">“{avaliacao.comentario}”</p>}
        <p className="rating-thanks">Obrigado por avaliar!</p>
      </div>
    );
  }

  // ── Sem permissão para avaliar por aqui (consulta por protocolo + e-mail) ──
  if (!onAvaliar) {
    return (
      <div className="rating-block" id="avaliar" ref={blocoRef}>
        <span className="chamado-field-label">Avaliação do atendimento</span>
        <p className="rating-hint">
          Para avaliar, use o link enviado no e-mail de conclusão do chamado.
        </p>
      </div>
    );
  }

  const ativa = hover || nota;

  // Setas mudam a nota, como num grupo de opções.
  const teclado = (e: React.KeyboardEvent, n: number) => {
    let prox = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") prox = Math.min(5, n + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") prox = Math.max(1, n - 1);
    if (!prox) return;
    e.preventDefault();
    setNota(prox);
    estrelasRef.current[prox - 1]?.focus();
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nota) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      await onAvaliar(nota, comentario.trim());
    } catch (err: any) {
      setErro(err?.response?.data?.error || "Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="rating-block rating-block--form" id="avaliar" ref={blocoRef} onSubmit={enviar}>
      <span className="chamado-field-label" id="rating-pergunta">
        Como foi o atendimento?
      </span>
      <div className="rating-pick-row">
        <div
          className="rating-pick"
          role="radiogroup"
          aria-labelledby="rating-pergunta"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              ref={(el) => {
                estrelasRef.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={nota === n}
              aria-label={`${n} de 5 — ${ROTULOS_NOTA[n]}`}
              // Só a estrela escolhida (ou a 1ª) entra no Tab; as setas
              // navegam entre elas.
              tabIndex={nota ? (nota === n ? 0 : -1) : n === 1 ? 0 : -1}
              className={`rating-pick-star${n <= ativa ? " is-on" : ""}`}
              onClick={() => setNota(n)}
              onMouseEnter={() => setHover(n)}
              onKeyDown={(e) => teclado(e, n)}
            >
              {n <= ativa ? <FaStar aria-hidden="true" /> : <FaRegStar aria-hidden="true" />}
            </button>
          ))}
        </div>
        <span className="rating-label" aria-live="polite">
          {ativa ? ROTULOS_NOTA[ativa] : "Escolha de 1 a 5"}
        </span>
      </div>

      {nota > 0 && (
        <>
          <label className="rating-comment-label" htmlFor="rating-comentario">
            Quer contar mais? <span>(opcional)</span>
          </label>
          <textarea
            id="rating-comentario"
            className="form-input rating-textarea"
            rows={3}
            maxLength={MAX_COMENTARIO}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="O que foi bom ou o que podemos melhorar?"
          />
        </>
      )}

      {erro && (
        <p className="chamado-alert" role="alert">
          <FiAlertCircle aria-hidden="true" /> {erro}
        </p>
      )}

      <div className="rating-actions">
        <button type="submit" className="form-button" disabled={enviando || !nota}>
          {enviando ? "Enviando..." : "Enviar avaliação"}
        </button>
      </div>
    </form>
  );
};

export default TicketRating;
