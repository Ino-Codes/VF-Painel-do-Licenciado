import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiUploadCloud, FiX, FiImage, FiFileText } from "react-icons/fi";
import api from "../../api.ts";
import Modal from "../ui/Modal.tsx";
import MonthPicker from "../forms/MonthPicker.tsx";
import { mesAtual } from "../praises/praiseMonths.ts";
import {
  ACCEPT,
  ArquivoCertificado,
  CertificadoExterno,
  MAX_ARQUIVOS,
  problemaDoArquivo,
  tamanhoLegivel,
} from "./certificadosExternos.ts";

interface Props {
  /** Certificado em edição; ausente = cadastro novo. */
  certificado?: CertificadoExterno | null;
  onClose: () => void;
  onSaved: (c: CertificadoExterno) => void;
}

const CertificadoExternoModal: React.FC<Props> = ({ certificado, onClose, onSaved }) => {
  const editando = !!certificado;
  const [nome, setNome] = useState(certificado?.nome ?? "");
  const [organizacao, setOrganizacao] = useState(certificado?.organizacao ?? "");
  const [mes, setMes] = useState(certificado?.mes ?? "");
  // Arquivos já salvos (edição) que continuam, e os novos escolhidos agora.
  const [existentes, setExistentes] = useState<ArquivoCertificado[]>(certificado?.arquivos ?? []);
  const [novos, setNovos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const total = existentes.length + novos.length;

  const adicionar = (lista: FileList | File[]) => {
    const aceitos: File[] = [];
    for (const f of Array.from(lista)) {
      const problema = problemaDoArquivo(f);
      if (problema) {
        toast.error(problema);
        continue;
      }
      aceitos.push(f);
    }
    const vagas = MAX_ARQUIVOS - total;
    if (aceitos.length > vagas) {
      toast.error(`Um certificado pode ter no máximo ${MAX_ARQUIVOS} arquivos.`);
    }
    setNovos((atual) => [...atual, ...aceitos.slice(0, Math.max(0, vagas))]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !organizacao.trim()) {
      toast.error("Preencha o nome do certificado e a organização emissora.");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      toast.error("Informe o mês e o ano de emissão.");
      return;
    }
    if (mes > mesAtual()) {
      toast.error("A data de emissão não pode ser futura.");
      return;
    }
    if (total < 1) {
      toast.error("Adicione ao menos uma imagem ou PDF do certificado.");
      return;
    }

    const fd = new FormData();
    fd.append("nome", nome.trim());
    fd.append("organizacao", organizacao.trim());
    fd.append("mes", mes);
    if (editando) {
      const mantidos = new Set(existentes.map((a) => a.id));
      const remover = certificado!.arquivos.filter((a) => !mantidos.has(a.id)).map((a) => a.id);
      fd.append("remover", JSON.stringify(remover));
    }
    novos.forEach((f) => fd.append("arquivos", f));

    setSalvando(true);
    try {
      const res = editando
        ? await api.put(`/api/user-certificates/${certificado!.id}`, fd)
        : await api.post("/api/user-certificates", fd);
      toast.success(editando ? "Certificado atualizado." : "Certificado adicionado.");
      onSaved(res.data as CertificadoExterno);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível salvar o certificado.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={editando ? "Editar certificado" : "Adicionar certificado ou diploma"}
      className="ext-cert-modal"
    >
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="ext-cert-field">
          <label htmlFor="ext-cert-nome">Nome do certificado ou diploma</label>
          <input
            id="ext-cert-nome"
            className="form-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Professional Scrum Master I"
            maxLength={200}
            required
          />
        </div>

        <div className="ext-cert-row">
          <div className="ext-cert-field">
            <label htmlFor="ext-cert-org">Organização emissora</label>
            <input
              id="ext-cert-org"
              className="form-input"
              value={organizacao}
              onChange={(e) => setOrganizacao(e.target.value)}
              placeholder="Ex.: Scrum.org"
              maxLength={200}
              required
            />
          </div>
          <div className="ext-cert-field ext-cert-field--mes">
            <label htmlFor="ext-cert-mes">Data de emissão</label>
            <MonthPicker inputId="ext-cert-mes" value={mes} onChange={setMes} />
          </div>
        </div>

        <div className="ext-cert-field">
          <span className="ext-cert-label">Arquivos</span>
          <div
            className={`ext-cert-drop${arrastando ? " ext-cert-drop--ativo" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              adicionar(e.dataTransfer.files);
            }}
          >
            <FiUploadCloud className="ext-cert-drop-icon" aria-hidden="true" />
            <p>
              Arraste aqui ou{" "}
              <button
                type="button"
                className="ext-cert-link"
                onClick={() => inputRef.current?.click()}
                disabled={total >= MAX_ARQUIVOS}
              >
                escolha os arquivos
              </button>
            </p>
            <span>
              Imagens (JPG, PNG, WEBP) até 10 MB ou PDF até 100 MB · até {MAX_ARQUIVOS} arquivos
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) adicionar(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {total > 0 && (
            <ul className="ext-cert-files">
              {existentes.map((a) => (
                <li key={`e-${a.id}`} className="ext-cert-file">
                  {a.tipo === "pdf" ? <FiFileText aria-hidden="true" /> : <FiImage aria-hidden="true" />}
                  <span className="ext-cert-file-nome">{a.nome}</span>
                  <span className="ext-cert-file-tam">{tamanhoLegivel(a.tamanho)}</span>
                  <button
                    type="button"
                    className="ext-cert-file-remover"
                    onClick={() => setExistentes((l) => l.filter((x) => x.id !== a.id))}
                    aria-label={`Remover ${a.nome}`}
                  >
                    <FiX />
                  </button>
                </li>
              ))}
              {novos.map((f, i) => (
                <li key={`n-${i}-${f.name}`} className="ext-cert-file ext-cert-file--novo">
                  {f.type === "application/pdf" ? <FiFileText aria-hidden="true" /> : <FiImage aria-hidden="true" />}
                  <span className="ext-cert-file-nome">{f.name}</span>
                  <span className="ext-cert-file-tam">{tamanhoLegivel(f.size)}</span>
                  <button
                    type="button"
                    className="ext-cert-file-remover"
                    onClick={() => setNovos((l) => l.filter((_, j) => j !== i))}
                    aria-label={`Remover ${f.name}`}
                  >
                    <FiX />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button type="submit" className="form-button" disabled={salvando}>
            {salvando ? "Enviando..." : editando ? "Salvar alterações" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CertificadoExternoModal;
