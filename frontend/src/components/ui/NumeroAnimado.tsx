import React, { useLayoutEffect, useRef } from "react";
import { animate } from "motion/react";
import { reduzMovimento } from "../../utils/animacao.ts";

// Número que conta até o valor (indicadores das telas de estatística).
// Na primeira vez conta a partir do zero; quando o valor muda (outro
// período, outro filtro), conta do valor anterior até o novo.

interface Props {
  valor: number;
  /** Casas decimais (padrão 0). */
  casas?: number;
  prefixo?: string;
  sufixo?: string;
  /** Duração em segundos (padrão 0,9). */
  duracao?: number;
}

const formatar = (v: number, casas: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const NumeroAnimado: React.FC<Props> = ({ valor, casas = 0, prefixo = "", sufixo = "", duracao = 0.9 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);

  // Layout effect: o primeiro quadro já sai com o valor inicial da contagem,
  // sem piscar o número final antes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const de = anterior.current;
    anterior.current = valor;
    const escreve = (v: number) => {
      el.textContent = `${prefixo}${formatar(v, casas)}${sufixo}`;
    };
    if (!Number.isFinite(valor) || de === valor || reduzMovimento()) {
      escreve(valor);
      return;
    }
    escreve(de);
    const controle = animate(de, valor, {
      duration: duracao,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: escreve,
    });
    return () => {
      controle.stop();
      escreve(valor);
    };
  }, [valor, casas, prefixo, sufixo, duracao]);

  // O texto é escrito só pelo efeito acima (antes da pintura). Se o React
  // também cuidasse dele, os dois brigariam pelo mesmo nó de texto.
  return <span ref={ref} className="numero-animado" />;
};

export default NumeroAnimado;
