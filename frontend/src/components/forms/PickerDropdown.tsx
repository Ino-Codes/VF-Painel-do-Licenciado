import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PickerDropdownProps {
  /** Elemento âncora — o campo ao qual o painel se alinha. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Clique fora (ou Esc) pede o fechamento. */
  onRequestClose: () => void;
  /** Classes do painel (ex.: "date-picker-dropdown"). */
  className?: string;
  children: React.ReactNode;
}

const MARGEM = 4;

/**
 * Painel de calendário ancorado a um campo, renderizado por portal no <body>.
 *
 * Dentro de um modal o dropdown não pode ser filho do formulário: o modal tem
 * `overflow-y: auto`, então um filho posicionado por `absolute` é recortado
 * pela área de rolagem e obriga a rolar para ver o calendário. Saindo para o
 * body com `position: fixed`, ele passa por cima do modal — o mesmo caminho
 * que o react-select já usa aqui via `menuPortalTarget`.
 */
const PickerDropdown: React.FC<PickerDropdownProps> = ({
  anchorRef,
  onRequestClose,
  className = "",
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposicionar = useCallback(() => {
    const ancora = anchorRef.current;
    const painel = panelRef.current;
    if (!ancora) return;

    const r = ancora.getBoundingClientRect();
    const altura = painel?.offsetHeight ?? 0;
    const largura = painel?.offsetWidth ?? 0;

    // Abre para baixo; se não couber, abre para cima do campo.
    const cabeAbaixo = r.bottom + MARGEM + altura <= window.innerHeight;
    const top = cabeAbaixo
      ? r.bottom + MARGEM
      : Math.max(MARGEM, r.top - MARGEM - altura);

    // Não deixa vazar pela direita da janela.
    const left = Math.max(
      MARGEM,
      Math.min(r.left, window.innerWidth - largura - MARGEM),
    );

    // Só troca o estado quando o valor muda de fato. Devolver um objeto novo a
    // cada medição criaria um laço: o efeito de layout depende de `children`,
    // o re-render mudaria a identidade e ele mediria outra vez, sem parar.
    setPos((atual) =>
      atual && atual.top === top && atual.left === left ? atual : { top, left },
    );
  }, [anchorRef]);

  // Mede depois de pintar (a altura do painel só existe renderizado) e
  // reposiciona junto com qualquer rolagem, inclusive a de dentro do modal —
  // daí o listener em fase de captura.
  useLayoutEffect(() => {
    reposicionar();
  }, [reposicionar, children]);

  useEffect(() => {
    const aoMover = () => reposicionar();
    window.addEventListener("resize", aoMover);
    window.addEventListener("scroll", aoMover, true);
    return () => {
      window.removeEventListener("resize", aoMover);
      window.removeEventListener("scroll", aoMover, true);
    };
  }, [reposicionar]);

  // Clique fora: o painel está no body, então "fora" tem de considerar as duas
  // partes — o campo e o próprio painel.
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (
        panelRef.current?.contains(alvo) ||
        anchorRef.current?.contains(alvo)
      ) {
        return;
      }
      onRequestClose();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRequestClose();
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [anchorRef, onRequestClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={`picker-portal ${className}`}
      style={
        {
          "--picker-top": `${pos?.top ?? 0}px`,
          "--picker-left": `${pos?.left ?? 0}px`,
          // Antes da primeira medição a posição ainda é 0,0: esconde para o
          // painel não piscar no canto da tela.
          "--picker-visibility": pos ? "visible" : "hidden",
        } as React.CSSProperties
      }
    >
      {children}
    </div>,
    document.body,
  );
};

export default PickerDropdown;
