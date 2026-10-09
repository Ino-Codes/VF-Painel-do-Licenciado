// Certificados e diplomas externos (Perfil): tipos e regras compartilhadas
// pela seção, pelo formulário e pela visualização.

export interface ArquivoCertificado {
  id: number;
  nome: string;
  tipo: "imagem" | "pdf";
  tamanho: number;
  /** Imagem: URL direta. PDF: null — o link é temporário, pedido ao abrir. */
  url: string | null;
}

export interface CertificadoExterno {
  id: number;
  nome: string;
  organizacao: string;
  /** "AAAA-MM" */
  mes: string;
  arquivos: ArquivoCertificado[];
}

// Mesmas regras do backend (routes/userCertificates.js e
// storage/documentos.js) — o backend confere de novo.
export const MAX_ARQUIVOS = 5;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";
const MB = 1024 * 1024;
export const LIMITE_IMAGEM = 10 * MB;
export const LIMITE_PDF = 100 * MB;

export const tamanhoLegivel = (bytes: number) =>
  bytes >= MB
    ? `${(bytes / MB).toFixed(1).replace(".", ",")} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Motivo para recusar o arquivo, ou null se ele é aceito. */
export const problemaDoArquivo = (f: File): string | null => {
  if (!TIPOS_ACEITOS.includes(f.type)) {
    return `"${f.name}" não é aceito. Envie imagens (JPG, PNG, WEBP) ou PDF.`;
  }
  const ehImagem = f.type.startsWith("image/");
  const limite = ehImagem ? LIMITE_IMAGEM : LIMITE_PDF;
  if (f.size > limite) {
    return `"${f.name}" tem ${tamanhoLegivel(f.size)}; o limite ${ehImagem ? "para imagens" : "para PDF"} é ${tamanhoLegivel(limite)}.`;
  }
  return null;
};

/**
 * Miniatura de uma imagem do Cloudinary: recorta e comprime no próprio CDN,
 * para o card não baixar a foto original inteira.
 */
export const miniatura = (url: string, largura = 640, altura = 400) =>
  url.includes("/image/upload/")
    ? url.replace(
        "/image/upload/",
        `/image/upload/c_fill,g_auto,w_${largura},h_${altura},q_auto,f_auto/`,
      )
    : url;
