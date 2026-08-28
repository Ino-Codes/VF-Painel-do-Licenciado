import React from "react";

interface ModalProps {
  onClose: () => void;
  /** Título no topo. Se omitido, o `<h2>` não é renderizado (modal com header próprio). */
  title?: string;
  children: React.ReactNode;
  /** Classe extra na superfície (ex.: "modal-wide", "feedback-fill-modal"). */
  className?: string;
  /** Classe extra no overlay (ex.: "modal-overlay--blur"). */
  overlayClassName?: string;
  /** Se true, clicar fora (no overlay) chama onClose. */
  closeOnOverlayClick?: boolean;
}

// Casca reutilizável de modal: overlay + superfície de vidro + botão fechar +
// título opcional. O conteúdo (formulário e ações) é passado como children —
// assim cada modal mantém seu próprio <form> envolvendo campos e `.modal-actions`,
// preservando o submit por Enter e a validação nativa.
const Modal: React.FC<ModalProps> = ({
  onClose,
  title,
  children,
  className,
  overlayClassName,
  closeOnOverlayClick,
}) => {
  return (
    <div
      className={`modal-overlay${overlayClassName ? ` ${overlayClassName}` : ""}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`modal-content${className ? ` ${className}` : ""}`}
        onClick={
          closeOnOverlayClick ? (e) => e.stopPropagation() : undefined
        }
      >
        <button
          type="button"
          className="modal-close-button"
          aria-label="Fechar"
          onClick={onClose}
        >
          &times;
        </button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
};

export default Modal;
