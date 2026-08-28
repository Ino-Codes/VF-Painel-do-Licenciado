import DOMPurify from "dompurify";

// Sanitiza HTML vindo do servidor (avisos do Tiptap, conteúdo de aulas) antes de
// injetá-lo via dangerouslySetInnerHTML. Defesa contra XSS armazenado — usar
// SEMPRE que renderizar HTML não confiável no DOM.
export const sanitizeHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html || "");
