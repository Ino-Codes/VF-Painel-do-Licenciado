import React from "react";

interface LoadingSpinnerProps {
  /** Texto sob a marca. O "..." não é usado: o anel já diz que algo corre. */
  label?: string;
  /**
   * "page" ocupa a tela toda, para rota carregando — e pinta a própria
   * superfície, porque nesse momento o conteúdo da página ainda não existe
   * para servir de fundo.
   * "inline" preenche só o espaço do bloco onde está (uma seção, uma aba).
   */
  variant?: "page" | "inline";
  /** Classe extra, quando o bloco precisa de uma altura própria. */
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = "Carregando",
  variant = "page",
  className = "",
}) => (
  <div
    className={`vf-loading vf-loading--${variant}${
      className ? ` ${className}` : ""
    }`}
    role="status"
    aria-live="polite"
  >
    <div className="vf-loading-mark" aria-hidden="true">
      <span className="vf-loading-ring" />
      <img
        className="vf-loading-logo"
        src={`${process.env.PUBLIC_URL || ""}/vcorporate.svg`}
        alt=""
      />
    </div>
    <p className="vf-loading-label">{label}</p>
  </div>
);

export default LoadingSpinner;
