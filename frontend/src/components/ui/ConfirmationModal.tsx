import React from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Texto do botão de confirmar (padrão "Confirmar"). */
  confirmLabel?: string;
  /** Classe do botão de confirmar: padrão vermelho (ação destrutiva). */
  confirmClassName?: string;
  confirmDisabled?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  confirmClassName = "form-button-delete",
  confirmDisabled = false,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content confirmation-modal">
        <button type="button" className="modal-close-button" aria-label="Fechar" onClick={onClose}>
          &times;
        </button>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={confirmClassName}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
