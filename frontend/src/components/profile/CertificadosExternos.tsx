import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiEdit, FiTrash2, FiPlus, FiFileText, FiAward } from "react-icons/fi";
import api from "../../api.ts";
import LoadingSpinner from "../ui/LoadingSpinner.tsx";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import { mesCurto } from "../praises/praiseMonths.ts";
import CertificadoExternoModal from "./CertificadoExternoModal.tsx";
import CertificadoExternoViewer from "./CertificadoExternoViewer.tsx";
import { CertificadoExterno, miniatura } from "./certificadosExternos.ts";

// Seção "Certificados e diplomas" do Perfil: certificados de outras
// organizações que o próprio colaborador cadastra.
const CertificadosExternos: React.FC = () => {
  const [lista, setLista] = useState<CertificadoExterno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  // undefined = fechado; null = novo; objeto = edição
  const [form, setForm] = useState<CertificadoExterno | null | undefined>(undefined);
  const [vendo, setVendo] = useState<CertificadoExterno | null>(null);
  const [excluindo, setExcluindo] = useState<CertificadoExterno | null>(null);

  useEffect(() => {
    api
      .get("/api/user-certificates/mine")
      .then((res) => setLista(res.data as CertificadoExterno[]))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  // Mantém a lista na mesma ordem do backend: mês de emissão, mais recente
  // primeiro.
  const ordenar = (l: CertificadoExterno[]) =>
    [...l].sort((a, b) => b.mes.localeCompare(a.mes) || b.id - a.id);

  const aoSalvar = (c: CertificadoExterno) => {
    setLista((l) => ordenar([...l.filter((x) => x.id !== c.id), c]));
    setForm(undefined);
  };

  const excluir = async () => {
    if (!excluindo) return;
    try {
      await api.delete(`/api/user-certificates/${excluindo.id}`);
      setLista((l) => l.filter((x) => x.id !== excluindo.id));
      toast.success("Certificado excluído.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível excluir.");
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <div className="profile-section">
      <h3>
        Certificados e diplomas
        {lista.length > 0 && (
          <button
            type="button"
            className="form-button form-button--add btn-icon-text"
            onClick={() => setForm(null)}
          >
            <FiPlus aria-hidden="true" />
            Adicionar
          </button>
        )}
      </h3>

      {carregando ? (
        <LoadingSpinner variant="inline" label="Carregando certificados" />
      ) : erro ? (
        <p className="ext-cert-vazio">Não foi possível carregar seus certificados.</p>
      ) : lista.length === 0 ? (
        <div className="ext-cert-vazio">
          <FiAward className="ext-cert-vazio-icon" aria-hidden="true" />
          <p>
            Cursos, certificações e diplomas de outras instituições. Adicione o
            nome, quem emitiu, quando, e uma foto ou o PDF do certificado.
          </p>
          <button
            type="button"
            className="form-button form-button--add btn-icon-text"
            onClick={() => setForm(null)}
          >
            <FiPlus aria-hidden="true" />
            Adicionar certificado
          </button>
        </div>
      ) : (
        <ul className="ext-cert-grid">
          {lista.map((c) => {
            const capa = c.arquivos.find((a) => a.tipo === "imagem" && a.url);
            return (
              <li key={c.id} className="ext-cert-card">
                <button
                  type="button"
                  className="ext-cert-thumb"
                  onClick={() => setVendo(c)}
                  aria-label={`Ver ${c.nome}`}
                >
                  {capa ? (
                    <img src={miniatura(capa.url!)} alt="" loading="lazy" />
                  ) : (
                    <span className="ext-cert-thumb-pdf">
                      <FiFileText aria-hidden="true" />
                      PDF
                    </span>
                  )}
                  {c.arquivos.length > 1 && (
                    <span className="ext-cert-thumb-count">{c.arquivos.length} arquivos</span>
                  )}
                </button>
                <div className="ext-cert-info">
                  <h4 title={c.nome}>{c.nome}</h4>
                  <p>{c.organizacao}</p>
                  <p className="ext-cert-data">Emitido em {mesCurto(c.mes)}</p>
                </div>
                <div className="ext-cert-actions">
                  <button
                    type="button"
                    className="form-icon-edit"
                    onClick={() => setForm(c)}
                    aria-label={`Editar ${c.nome}`}
                    title="Editar"
                  >
                    <FiEdit />
                  </button>
                  <button
                    type="button"
                    className="form-icon-delete"
                    onClick={() => setExcluindo(c)}
                    aria-label={`Excluir ${c.nome}`}
                    title="Excluir"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form !== undefined && (
        <CertificadoExternoModal
          certificado={form}
          onClose={() => setForm(undefined)}
          onSaved={aoSalvar}
        />
      )}

      {vendo && <CertificadoExternoViewer certificado={vendo} onClose={() => setVendo(null)} />}

      <ConfirmationModal
        isOpen={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir certificado"
        message={`Excluir "${excluindo?.nome}" e os arquivos dele? Essa ação não pode ser desfeita.`}
      />
    </div>
  );
};

export default CertificadosExternos;
