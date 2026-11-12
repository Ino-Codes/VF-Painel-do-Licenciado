import React, { useEffect, useRef, useState } from "react";
import { reduzMovimento } from "../../utils/animacao.ts";

// Chuva de confete nas cores da marca, uma vez, por cima da tela inteira.
// Usada na aprovação do quiz do curso. Não recebe clique e some sozinha.

const CORES = ["#8a6c35", "#d9bf8a", "#b8934d", "#080807", "#ffffff"];
const QUADROS = 150;

const Confete: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ativo, setAtivo] = useState(() => !reduzMovimento());

  useEffect(() => {
    const canvas = ref.current;
    if (!ativo || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Dois jatos, dos cantos de baixo para o meio da tela.
    const pecas = Array.from({ length: 160 }, (_, i) => {
      const daEsquerda = i % 2 === 0;
      return {
        x: daEsquerda ? w * 0.08 : w * 0.92,
        y: h * 0.95,
        vx: (daEsquerda ? 1 : -1) * (3 + Math.random() * 7),
        vy: -(11 + Math.random() * 9),
        giro: Math.random() * Math.PI,
        vgiro: (Math.random() - 0.5) * 0.35,
        cor: CORES[i % CORES.length],
        tam: 5 + Math.random() * 6,
      };
    });

    let quadro = 0;
    let pedido = 0;
    const desenha = () => {
      quadro++;
      ctx.clearRect(0, 0, w, h);
      const alfa = quadro < QUADROS - 40 ? 1 : Math.max(0, (QUADROS - quadro) / 40);
      for (const p of pecas) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.vgiro;
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.tam / 2, -p.tam * 0.8, p.tam, p.tam * 1.6);
        ctx.restore();
      }
      if (quadro < QUADROS) pedido = requestAnimationFrame(desenha);
      else setAtivo(false);
    };
    pedido = requestAnimationFrame(desenha);
    return () => cancelAnimationFrame(pedido);
  }, [ativo]);

  if (!ativo) return null;
  return <canvas ref={ref} className="confete-tela" aria-hidden="true" />;
};

export default Confete;
