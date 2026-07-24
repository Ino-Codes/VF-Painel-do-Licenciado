import React from "react";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>Como funciona o Fracionamento de Férias?</h2>

        <p>
          De acordo com a legislação (CLT), o colaborador tem direito a 30 dias
          de férias após 12 meses de trabalho.
          <br />O nosso sistema permite que você fracione este período para
          melhor se adequar ao seu planeamento e ao da equipe, seguindo estas
          regras:
        </p>

        <ul>
          <li>
            <strong>Até 3 Períodos:</strong> Você pode dividir o seu saldo total
            de férias em até três períodos separados durante o ano.
          </li>
          <br />
          <li>
            <strong>Período Maior:</strong> Para que o fracionamento seja
            válido, um dos seus períodos deve ter, no mínimo, 14 dias corridos.
          </li>
          <br />
          <li>
            <strong>Períodos Menores:</strong> Os outros períodos (se houver)
            não podem ser inferiores a 5 dias corridos cada um.
          </li>
          <br />
          <li>
            <strong>Quando Começar</strong> As suas férias não podem começar nos
            dois dias que antecedem um feriado ou o seu dia de descanso semanal
            (geralmente sábado e domingo).
          </li>
        </ul>
        <div className="info-modal-content">{children}</div>

        <div className="modal-actions modal-actions--center">
          <button type="button" onClick={onClose} className="form-button">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
