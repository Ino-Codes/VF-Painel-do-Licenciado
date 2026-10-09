import React, { useState } from "react";
import toast from "react-hot-toast";
import { FiExternalLink, FiFileText } from "react-icons/fi";
import api from "../../api.ts";
import Modal from "../ui/Modal.tsx";
import { mesTitulo } from "../praises/praiseMonths.ts";
import { CertificadoExterno, tamanhoLegivel } from "./certificadosExternos.ts";

interface Props {
  certificado: CertificadoExterno;
  onClose: () => void;
}

// Mostra todos os arquivos do certificado: imagens na própria tela e PDFs
// como itens que abrem numa nova aba (link temporário pedido na hora).
const CertificadoExternoViewer: React.FC<Props> = ({ certificado, onClose }) => {
  const [abrindo, setAbrindo] = useState<number | null>(null);

  const abrirPdf = async (arquivoId: number) => {
    // Abre a aba já no clique — pedida depois do await, o navegador
    // trataria como pop-up e bloquearia.
    const aba = window.open("", "_blank");
    setAbrindo(arquivoId);
    try {
      const res = await api.get(`/api/user-certificates/arquivos/${arquivoId}/link`);
      if (aba) aba.location.href = res.data.url;
      else window.location.href = res.data.url;
    } catch (err: any) {
      aba?.close();
      toast.error(err?.response?.data?.error || "Não foi possível abrir o arquivo.");
    } finally {
      setAbrindo(null);
    }
  };

  return (
    <Modal onClose={onClose} className="modal-wide ext-cert-viewer" closeOnOverlayClick>
      <header className="ext-cert-viewer-head">
        <h2>{certificado.nome}</h2>
        <p>
          {certificado.organizacao} · emitido em {mesTitulo(certificado.mes).toLowerCase()}
        </p>
      </header>

      <div className="ext-cert-viewer-files">
        {certificado.arquivos.map((a) =>
          a.tipo === "imagem" && a.url ? (
            <figure key={a.id} className="ext-cert-viewer-img">
              <img src={a.url} alt={`${certificado.nome} — ${a.nome}`} loading="lazy" />
              <figcaption>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  Abrir em tamanho original <FiExternalLink aria-hidden="true" />
                </a>
              </figcaption>
            </figure>
          ) : (
            <div key={a.id} className="ext-cert-viewer-pdf">
              <FiFileText className="ext-cert-viewer-pdf-icon" aria-hidden="true" />
              <div>
                <p className="ext-cert-viewer-pdf-nome">{a.nome}</p>
                <p className="ext-cert-viewer-pdf-tam">PDF · {tamanhoLegivel(a.tamanho)}</p>
              </div>
              <button
                type="button"
                className="form-button btn-icon-text"
                onClick={() => abrirPdf(a.id)}
                disabled={abrindo === a.id}
              >
                <FiExternalLink aria-hidden="true" />
                {abrindo === a.id ? "Abrindo..." : "Abrir PDF"}
              </button>
            </div>
          ),
        )}
      </div>
    </Modal>
  );
};

export default CertificadoExternoViewer;
