import React, { useState, useEffect, useRef } from "react";
import { FiTrash2 } from "react-icons/fi";
import { FaQuoteLeft, FaHeart } from "react-icons/fa";

export interface Praise {
  id: number;
  message: string;
  created_at: string;
  published_at?: string | null;
  recipient_id?: number | null;
  recipient_name?: string | null;
  recipient_cargo?: string | null;
  recipient_setor?: string | null;
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

// Altura máxima (px) da mensagem antes de colapsar com "Ver mais".
const CLAMP_MAX_HEIGHT = 160;

// Mensagem do elogio com colapso: textos longos são cortados (com fade) e um
// botão "Ver mais"/"Ver menos" só aparece quando há conteúdo além do limite.
export const PraiseMessage: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > CLAMP_MAX_HEIGHT + 8);
  }, [text]);

  return (
    <>
      <p
        ref={ref}
        className={`praise-card-message ${
          overflowing && !expanded ? "praise-card-message--clamped" : ""
        }`}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          className="link-button praise-readmore"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </>
  );
};

interface Props {
  praise: Praise;
  // Exibe o cabeçalho com o destinatário (pessoa ou setor). Desligue em telas
  // onde o destinatário já é o contexto (modal da própria pessoa, Perfil).
  showRecipient?: boolean;
  // Exibe o selo Rascunho/Publicado (visão do curador).
  showStatus?: boolean;
  // Quando presente, exibe o botão de remover (moderação do curador).
  onDelete?: (id: number) => void;
  // "testimonial": estilo de depoimento (aspas + coração), sem borda lateral.
  variant?: "default" | "testimonial";
}

const PraiseCard: React.FC<Props> = ({
  praise: p,
  showRecipient = true,
  showStatus = false,
  onDelete,
  variant = "default",
}) => {
  const isPublished = Boolean(p.published_at);

  if (variant === "testimonial") {
    return (
      <article className="praise-card praise-card--testimonial">
        <FaQuoteLeft className="praise-quote-mark" aria-hidden="true" />
        <PraiseMessage text={p.message} />
        <footer className="praise-card-foot">
          <span className="praise-date">{formatDate(p.created_at)}</span>
        </footer>
      </article>
    );
  }

  return (
    <article className="praise-card">
      {(showRecipient || showStatus || onDelete) && (
        <header className="praise-card-head">
          {showRecipient && (
            <div className="praise-card-recipient">
              {p.recipient_name ? (
                <>
                  <span className="praise-recipient-name">
                    {p.recipient_name}
                  </span>
                  {(p.recipient_cargo || p.recipient_setor) && (
                    <span className="praise-recipient-role">
                      {[p.recipient_cargo, p.recipient_setor]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="praise-recipient-name">
                    {p.recipient_setor}
                  </span>
                  <span className="praise-recipient-role">Setor</span>
                </>
              )}
            </div>
          )}

          <div className="praise-card-head-actions">
            {showStatus && (
              <span
                className={`praise-status ${
                  isPublished ? "praise-status--published" : "praise-status--draft"
                }`}
              >
                {isPublished ? "Publicado" : "Rascunho"}
              </span>
            )}
            {onDelete && (
              <button
                className="form-icon-delete praise-delete"
                title="Remover elogio"
                aria-label="Remover elogio"
                onClick={() => onDelete(p.id)}
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </header>
      )}

      <PraiseMessage text={p.message} />

      <footer className="praise-card-foot">
        <span className="praise-date">{formatDate(p.created_at)}</span>
      </footer>
    </article>
  );
};

export default PraiseCard;
