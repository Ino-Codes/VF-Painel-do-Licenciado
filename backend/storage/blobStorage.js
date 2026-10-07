// ═══════════════════════════════════════════════════════════════════════════
// Azure Blob Storage — armazenamento de DOCUMENTOS (PDF, Office, etc.)
// ═══════════════════════════════════════════════════════════════════════════
// Único ponto do backend que conversa com o Azure. As rotas só usam:
//   enviar()        → grava o arquivo e devolve o nome do blob
//   excluir()       → apaga (sem erro se já não existir)
//   urlDeAcesso()   → link temporário (SAS) só de leitura, para download
//   verificarConexao() → chamado no boot; loga se está tudo certo
//
// Imagens continuam no Cloudinary (transformações/otimização); aqui ficam
// só os documentos, que esbarravam no limite de 10 MB do plano gratuito.
//
// Configuração (.env do backend / Application settings do App Service):
//   AZURE_STORAGE_CONNECTION_STRING  connection string da Storage Account
//   AZURE_STORAGE_CONTAINER          nome do container (padrão: documentos)
//
// O container é PRIVADO: nenhum arquivo é acessível sem um link assinado
// gerado aqui, que expira em poucos minutos.

const crypto = require("crypto");
const {
  BlobServiceClient,
  BlobSASPermissions,
  SASProtocol,
} = require("@azure/storage-blob");

let _container = null;

const nomeDoContainer = () => process.env.AZURE_STORAGE_CONTAINER || "documentos";

/** true quando a connection string está configurada. */
const configurado = () => Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);

const container = () => {
  if (!configurado()) {
    throw new Error("Azure Blob Storage não configurado (AZURE_STORAGE_CONNECTION_STRING).");
  }
  if (!_container) {
    _container = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
    ).getContainerClient(nomeDoContainer());
  }
  return _container;
};

// Nome de arquivo seguro para usar no caminho do blob: sem acento, sem
// espaço e sem caracteres especiais, com tamanho limitado.
const nomeSeguro = (nome) => {
  const limpo = String(nome || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|_+$/g, "");
  return (limpo || "arquivo").slice(-120);
};

/**
 * Grava um arquivo no container.
 * O nome do blob é `pasta/AAAA-MM/uuid-nome.ext`: único (o uuid evita
 * colisão entre arquivos de mesmo nome) e legível no portal do Azure.
 * @returns {Promise<{ blobName: string, url: string }>} `url` é a URL do
 *   blob SEM assinatura — serve de referência, mas não abre sozinha (o
 *   container é privado); para baixar use urlDeAcesso().
 */
async function enviar({ buffer, nomeOriginal, contentType, pasta }) {
  const mes = new Date().toISOString().slice(0, 7);
  const blobName = `${nomeSeguro(pasta || "geral")}/${mes}/${crypto.randomUUID()}-${nomeSeguro(nomeOriginal)}`;
  const blob = container().getBlockBlobClient(blobName);
  // uploadData divide arquivos grandes em blocos e envia em paralelo.
  await blob.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType || "application/octet-stream",
    },
  });
  return { blobName, url: blob.url };
}

/** Apaga um blob. Não falha se ele já não existir. */
async function excluir(blobName) {
  if (!blobName) return;
  await container().getBlockBlobClient(blobName).deleteIfExists();
}

// Content-Disposition com o nome original: versão ASCII para navegadores
// antigos + versão UTF-8 (RFC 5987) para preservar acentos.
const contentDisposition = (nomeOriginal, inline) => {
  const nome = String(nomeOriginal || "arquivo");
  const ascii = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
};

/**
 * Link temporário (SAS) só de leitura para um blob.
 * @param {string} blobName
 * @param {string} nomeOriginal  nome com que o arquivo será baixado
 * @param {{ minutos?: number, inline?: boolean }} [opcoes]
 *   minutos: validade do link (padrão 5); inline: abre no navegador em vez
 *   de baixar (útil para PDF).
 */
async function urlDeAcesso(blobName, nomeOriginal, { minutos = 5, inline = false } = {}) {
  const agora = Date.now();
  const blob = container().getBlobClient(blobName);
  return blob.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      // Começa 5 min no passado: tolera relógios levemente adiantados.
      startsOn: new Date(agora - 5 * 60 * 1000),
      expiresOn: new Date(agora + minutos * 60 * 1000),
      // Só HTTPS. A exceção é um endpoint http (emulador local Azurite).
      protocol: blob.url.startsWith("https:") ? SASProtocol.Https : SASProtocol.HttpsAndHttp,
      contentDisposition: contentDisposition(nomeOriginal, inline),
    });
}

/**
 * Chamado no boot. Cria o container (privado) se ainda não existir e loga
 * o resultado — erro de configuração aparece no deploy, não no primeiro
 * upload de um usuário. Nunca derruba o servidor.
 */
async function verificarConexao() {
  if (!configurado()) {
    console.warn(
      "[Blob Storage] AZURE_STORAGE_CONNECTION_STRING não definida — documentos continuarão indo para o Cloudinary (limite de 10 MB).",
    );
    return false;
  }
  try {
    const resp = await container().createIfNotExists();
    console.log(
      `[Blob Storage] Container "${nomeDoContainer()}" ${resp.succeeded ? "criado" : "acessível"}.`,
    );
    return true;
  } catch (err) {
    console.error(`[Blob Storage] Falha ao acessar o container "${nomeDoContainer()}":`, err.message);
    return false;
  }
}

module.exports = {
  configurado,
  enviar,
  excluir,
  urlDeAcesso,
  verificarConexao,
};
