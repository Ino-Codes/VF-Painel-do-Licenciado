// Peças de animação compartilhadas pelo Painel.
//
// As animações de componente usam o Motion (motion/react). O <MotionConfig
// reducedMotion="user"> no index.tsx já desliga movimento para quem pede
// "reduzir movimento" no sistema; o que é feito à mão aqui confere o mesmo.

import { useEffect, useRef, useState } from "react";

export const reduzMovimento = (): boolean =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Curva de entrada: começa rápido e assenta devagar. */
export const ENTRADA = [0.2, 0.8, 0.2, 1] as const;
/** Mola curta, sem balanço exagerado (menus, barras). */
export const MOLA = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 } as const;

/**
 * Ref de callback para o overlay de um modal: anima a SAÍDA.
 *
 * O React tira o modal da tela de uma vez quando ele fecha, sem chance de
 * animar. Para não mexer nos ~50 lugares que abrem modais com
 * `{aberto && <Modal/>}`, o overlay deixa uma cópia visual no lugar, que
 * esmaece e some sozinha. A cópia não recebe clique nem leitor de tela.
 *
 * Uso: `<div className="modal-overlay" ref={saidaAnimada}>`.
 * (React 19: a função devolvida roda quando o elemento sai da tela.)
 */
export function saidaAnimada(el: HTMLElement | null) {
  if (!el) return;
  return () => {
    if (reduzMovimento()) return;
    const pai = el.parentNode;
    if (!pai) return;
    const proximo = el.nextSibling;

    const copia = el.cloneNode(true) as HTMLElement;
    // O clone não leva o que foi digitado nos campos.
    const originais = el.querySelectorAll<HTMLInputElement>("input, textarea, select");
    const clones = copia.querySelectorAll<HTMLInputElement>("input, textarea, select");
    originais.forEach((o, i) => {
      const c = clones[i];
      if (!c) return;
      if (o.type === "checkbox" || o.type === "radio") c.checked = o.checked;
      else if (o.type !== "file") c.value = o.value;
    });
    copia.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    copia.classList.add("modal-saindo");
    copia.setAttribute("aria-hidden", "true");
    copia.setAttribute("inert", "");

    // Espera o React terminar de tirar o original. Se ele continua na tela
    // (o componente só remontou) ou se a página inteira saiu, não anima.
    queueMicrotask(() => {
      if (el.isConnected || !(pai as Node).isConnected) return;
      pai.insertBefore(copia, proximo && proximo.parentNode === pai ? proximo : null);
      const superficie = copia.firstElementChild as HTMLElement | null;
      const animacoes = [
        copia.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 190,
          easing: "cubic-bezier(.4,0,1,1)",
          fill: "forwards",
        }).finished,
      ];
      if (superficie) {
        animacoes.push(
          superficie.animate(
            [
              { transform: "none" },
              { transform: "translateY(8px) scale(0.97)" },
            ],
            { duration: 190, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
          ).finished,
        );
      }
      Promise.all(animacoes)
        .catch(() => {})
        .finally(() => copia.remove());
    });
  };
}

/**
 * Ids que acabaram de aparecer numa lista (cadastro novo), para destacar a
 * linha por um instante. Troca de página ou de filtro muda quase tudo de uma
 * vez — aí nada é destacado, senão a tabela inteira piscaria.
 */
export function useIdsNovos(ids: Array<number | string>, limite = 2): Set<number | string> {
  const anteriores = useRef<Set<number | string> | null>(null);
  const [novos, setNovos] = useState<Set<number | string>>(() => new Set());
  const assinatura = ids.join(",");

  useEffect(() => {
    const atuais = new Set(ids);
    const antes = anteriores.current;
    anteriores.current = atuais;
    if (!antes || antes.size === 0) return;
    const chegaram = ids.filter((id) => !antes.has(id));
    if (chegaram.length === 0 || chegaram.length > limite) return;
    setNovos(new Set(chegaram));
    // A assinatura resume a lista; `ids` muda de identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, limite]);

  // O destaque dura o tempo da animação da linha.
  useEffect(() => {
    if (novos.size === 0) return;
    const t = setTimeout(() => setNovos(new Set()), 1600);
    return () => clearTimeout(t);
  }, [novos]);

  return novos;
}

/**
 * Linhas de tabela do admin (motion.tr dentro de <AnimatePresence>): a linha
 * excluída sai de lado e as de baixo sobem. Troca de página ou de filtro
 * troca tudo de uma vez — aí a saída é instantânea, senão a tabela dobraria
 * de tamanho por um instante.
 */
export const LINHA_TABELA = {
  saida: (animar: boolean) =>
    animar
      ? { opacity: 0, x: 24, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } }
      : { opacity: 0, transition: { duration: 0 } },
};

/**
 * true quando a última mudança da lista tirou só uma ou duas linhas.
 * O resultado vale até a lista mudar de novo: outra renderização no meio da
 * animação de saída não a interrompe.
 */
export function useRemocaoPontual(ids: Array<number | string>): boolean {
  const assinatura = ids.join(",");
  const estado = useRef<{ assinatura: string; ids: Set<number | string>; animar: boolean } | null>(null);

  const atual = estado.current;
  if (!atual || atual.assinatura !== assinatura) {
    let animar = false;
    if (atual) {
      const agora = new Set(ids);
      let saiu = 0;
      atual.ids.forEach((id) => {
        if (!agora.has(id)) saiu++;
      });
      const entrou = ids.filter((id) => !atual.ids.has(id)).length;
      animar = saiu > 0 && saiu <= 2 && entrou <= 1;
    }
    // Calculado a partir das props, sempre igual para a mesma lista.
    estado.current = { assinatura, ids: new Set(ids), animar };
  }
  return estado.current!.animar;
}
