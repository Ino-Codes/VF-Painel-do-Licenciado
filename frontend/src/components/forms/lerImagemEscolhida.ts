import type React from "react";
import toast from "react-hot-toast";

// Valida a imagem escolhida num <input type="file"> antes de abrir o editor
// de recorte. Devolve um object URL (quem usa revoga) ou null se recusou.

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
// Limite da foto original: o que sobe é o recorte, bem menor.
const MAX_MB = 15;

interface Opcoes {
  /** Abaixo de 60% disso a imagem esticaria e ficaria borrada: só avisa. */
  larguraIdeal: number;
  alturaIdeal: number;
}

export function lerImagemEscolhida(
  e: React.ChangeEvent<HTMLInputElement>,
  { larguraIdeal, alturaIdeal }: Opcoes,
): Promise<string | null> {
  const file = e.target.files?.[0];
  e.target.value = ""; // permite escolher o mesmo arquivo de novo
  if (!file) return Promise.resolve(null);
  if (!TIPOS.includes(file.type)) {
    toast.error("Envie uma imagem JPG, PNG ou WEBP.");
    return Promise.resolve(null);
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    toast.error(`A imagem deve ter no máximo ${MAX_MB} MB.`);
    return Promise.resolve(null);
  }
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width < larguraIdeal * 0.6 || img.height < alturaIdeal * 0.6) {
        toast(
          `A imagem tem ${img.width} × ${img.height} px e pode ficar desfocada. O ideal é ${larguraIdeal} × ${alturaIdeal} px ou maior.`,
          { id: "imagem-pequena" },
        );
      }
      resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Não foi possível ler o arquivo de imagem.");
      resolve(null);
    };
    img.src = url;
  });
}
