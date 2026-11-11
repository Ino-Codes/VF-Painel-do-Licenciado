// Gera a imagem final a partir do recorte feito no EditorDeImagem
// (react-easy-crop): aplica o giro, recorta a área escolhida e entrega um
// JPEG já no tamanho final. Usado pela capa e pela foto de perfil.

export interface AreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TamanhoFinal {
  largura: number;
  altura: number;
}

/** Capa do perfil: padrão do LinkedIn (4:1). */
export const TAMANHO_CAPA: TamanhoFinal = { largura: 1584, altura: 396 };
/** Foto de perfil: quadrada (exibida redonda), folgada para telas retina. */
export const TAMANHO_AVATAR: TamanhoFinal = { largura: 512, altura: 512 };

// Lado máximo da imagem de trabalho: fotos de celular (4000 px+) giradas
// gerariam um canvas grande demais para alguns navegadores.
const LADO_MAXIMO = 4096;
// Fundo dos cantos que o giro pode deixar à mostra (preto da marca).
const FUNDO = "#080807";

const carregar = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = src;
  });

const radianos = (graus: number) => (graus * Math.PI) / 180;

/** Tamanho da caixa que contém a imagem girada. */
const caixaGirada = (largura: number, altura: number, graus: number) => {
  const r = radianos(graus);
  return {
    largura: Math.abs(Math.cos(r) * largura) + Math.abs(Math.sin(r) * altura),
    altura: Math.abs(Math.sin(r) * largura) + Math.abs(Math.cos(r) * altura),
  };
};

export async function cortarImagem(
  src: string,
  area: AreaPixels,
  rotacao: number,
  tamanho: TamanhoFinal,
): Promise<Blob> {
  const img = await carregar(src);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;

  // 1. Imagem girada, inteira, num canvas do tamanho da caixa girada (as
  //    coordenadas do recorte vêm nesse referencial).
  const caixa = caixaGirada(w, h, rotacao);
  const girada = document.createElement("canvas");
  girada.width = Math.round(caixa.largura);
  girada.height = Math.round(caixa.altura);
  const g = girada.getContext("2d");
  if (!g) throw new Error("Seu navegador não permite editar imagens.");
  g.fillStyle = FUNDO;
  g.fillRect(0, 0, girada.width, girada.height);
  g.imageSmoothingQuality = "high";
  g.translate(girada.width / 2, girada.height / 2);
  g.rotate(radianos(rotacao));
  g.drawImage(img, -w / 2, -h / 2, w, h);

  // 2. Recorte da área escolhida, já no tamanho final.
  const saida = document.createElement("canvas");
  saida.width = tamanho.largura;
  saida.height = tamanho.altura;
  const s = saida.getContext("2d");
  if (!s) throw new Error("Seu navegador não permite editar imagens.");
  s.fillStyle = FUNDO;
  s.fillRect(0, 0, tamanho.largura, tamanho.altura);
  s.imageSmoothingQuality = "high";
  s.drawImage(
    girada,
    area.x * escala,
    area.y * escala,
    area.width * escala,
    area.height * escala,
    0,
    0,
    tamanho.largura,
    tamanho.altura,
  );

  return new Promise<Blob>((resolve, reject) =>
    saida.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))),
      "image/jpeg",
      0.9,
    ),
  );
}
