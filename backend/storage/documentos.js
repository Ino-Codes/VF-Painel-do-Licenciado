// ═══════════════════════════════════════════════════════════════════════════
// Documentos enviados pelo Painel: decide ONDE cada arquivo fica.
// ═══════════════════════════════════════════════════════════════════════════
//   • imagem    → Cloudinary (otimização/transformações; até 10 MB no plano
//                 gratuito)
//   • documento → Azure Blob Storage (PDF, Office…; até LIMITE_AZURE)
//
// Cada linha do banco guarda `storage` ('cloudinary' | 'azure'). Download e
// exclusão olham esse campo, então arquivos antigos (Cloudinary) e novos
// (Azure) convivem — a migração dos antigos pode ser feita aos poucos.
//
// Se o Azure não estiver configurado, documentos continuam indo para o
// Cloudinary (com o limite de 10 MB), para o Painel não parar.

const blobStorage = require("./blobStorage.js");

const MB = 1024 * 1024;
const LIMITE_CLOUDINARY = 10 * MB; // plano gratuito: imagem e raw
const LIMITE_AZURE = 100 * MB; // o arquivo passa pela memória do servidor

class ErroDeUpload extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

const emMB = (bytes) => (bytes / MB).toFixed(1).replace(".", ",").replace(",0", "");

const extensao = (nome) => {
  const m = String(nome || "").match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "";
};

module.exports = function (cloudinary) {
  /**
   * Grava o arquivo enviado (multer) no destino certo.
   * @param {object} p
   * @param {object} p.file          req.file do multer
   * @param {string} p.nomeExibicao  nome digitado pelo usuário
   * @param {string} p.pasta         prefixo no Azure (ex.: "biblioteca")
   * @param {string} [p.category]    pasta/tag no Cloudinary
   * @param {string} [p.folder]      tag no Cloudinary
   * @returns {Promise<{ storage, url, publicId, blobName }>}
   */
  async function salvar({ file, nomeExibicao, pasta, category, folder }) {
    const ehImagem = file.mimetype.startsWith("image/");
    const noAzure = !ehImagem && blobStorage.configurado();
    const limite = noAzure ? LIMITE_AZURE : LIMITE_CLOUDINARY;

    // Checa antes de enviar: sem isso o arquivo inteiro vai até o provedor
    // só para ser recusado, e o usuário recebe um erro genérico.
    if (file.size > limite) {
      throw new ErroDeUpload(
        413,
        `O arquivo tem ${emMB(file.size)} MB e o limite ${ehImagem ? "para imagens " : ""}é de ${emMB(limite)} MB.`,
      );
    }

    if (noAzure) {
      const { blobName, url } = await blobStorage.enviar({
        buffer: file.buffer,
        nomeOriginal: file.originalname,
        contentType: file.mimetype,
        pasta,
      });
      return { storage: "azure", url, publicId: null, blobName };
    }

    // Cloudinary — mesmo comportamento de antes.
    const resourceType = ehImagem ? "image" : "raw";
    const ext = extensao(file.originalname);
    const cleanName = String(nomeExibicao || file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniquePublicId = `${cleanName}_${Date.now()}${ext ? "." + ext : ""}`;

    const resultado = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: resourceType,
            folder: category,
            tags: [category, folder].filter(Boolean),
            ...(resourceType === "raw" && { public_id: uniquePublicId }),
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        )
        .end(file.buffer);
    });
    return {
      storage: "cloudinary",
      url: resultado.secure_url,
      publicId: resultado.public_id,
      blobName: null,
    };
  }

  /** Apaga o arquivo físico de uma linha (files/archives). */
  async function excluir(linha) {
    if (linha.storage === "azure") {
      await blobStorage.excluir(linha.blob_name);
      return;
    }
    if (linha.public_id) {
      const resourceType = String(linha.filename || "").includes("/image/") ? "image" : "raw";
      await cloudinary.uploader.destroy(linha.public_id, { resource_type: resourceType });
    }
  }

  /**
   * Link temporário (5 min) para baixar o arquivo de uma linha, com o nome
   * que o usuário deu a ele.
   */
  async function linkDeDownload(linha) {
    if (linha.storage === "azure") {
      // O nome de exibição pode não ter extensão; usa a do arquivo real.
      const ext = extensao(linha.blob_name);
      let nome = linha.originalname || "arquivo";
      if (ext && extensao(nome) !== ext) nome = `${nome}.${ext}`;
      return blobStorage.urlDeAcesso(linha.blob_name, nome, { minutos: 5 });
    }

    // Cloudinary — lógica original de files.js/archives.js.
    if (!linha.filename) throw new ErroDeUpload(500, "URL do arquivo não encontrada no banco de dados.");
    const isRaw = linha.filename.includes("/raw/upload/");
    const urlExtMatch = linha.filename.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    const extNoDot = urlExtMatch ? urlExtMatch[1] : "";
    const urlExt = extNoDot ? "." + extNoDot : "";

    // Nome SEM extensão: o Cloudinary dá erro 400 se houver ponto no
    // fl_attachment.
    let cleanName = linha.originalname || "arquivo";
    const dot = cleanName.lastIndexOf(".");
    if (dot > -1) cleanName = cleanName.substring(0, dot);
    cleanName = cleanName.replace(/[^a-zA-Z0-9_-]/g, "_");

    const options = {
      resource_type: isRaw ? "raw" : "image",
      secure: true,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    };
    let publicId = linha.public_id;
    if (!isRaw) {
      // Imagem ou PDF salvo como image: attachment sem a extensão.
      options.flags = `attachment:${cleanName}`;
      if (extNoDot) options.format = extNoDot;
      if (publicId.endsWith(urlExt)) publicId = publicId.slice(0, -urlExt.length);
    } else if (urlExt && !publicId.endsWith(urlExt)) {
      // Raw (ex.: DOCX): o public_id precisa ter a extensão.
      publicId += urlExt;
    }
    return cloudinary.url(publicId, options);
  }

  return { salvar, excluir, linkDeDownload, ErroDeUpload, LIMITE_AZURE, LIMITE_CLOUDINARY };
};
