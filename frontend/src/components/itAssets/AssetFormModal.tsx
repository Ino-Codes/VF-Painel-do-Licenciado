import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api.ts";
import Modal from "../ui/Modal.tsx";
import DatePicker from "../forms/DatePicker.tsx";
import { Asset, AssetType, rotuloNumeroSerie } from "./assetConfig.ts";

interface AssetFormModalProps {
  /** Ativo em edição; ausente = cadastro novo. */
  asset?: Asset | null;
  tipos: AssetType[];
  /** Tipo pré-selecionado no cadastro (a aba aberta na tela). */
  tipoInicial?: number | null;
  /** Marcas e modelos já cadastrados, sugeridos nos campos de texto. */
  sugestoes: { marcas: string[]; modelos: string[] };
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}

// Admin local: três estados — não informado, mantidos ou removidos.
const adminLocalParaCampo = (v: boolean | null | undefined) =>
  v === true ? "mantidos" : v === false ? "removidos" : "";

const AssetFormModal: React.FC<AssetFormModalProps> = ({
  asset,
  tipos,
  tipoInicial,
  sugestoes,
  onClose,
  onSaved,
}) => {
  const editando = !!asset;
  const [form, setForm] = useState({
    type_id: String(asset?.type_id ?? tipoInicial ?? tipos[0]?.id ?? ""),
    patrimonio: asset?.patrimonio ?? "",
    marca: asset?.marca ?? "",
    modelo: asset?.modelo ?? "",
    numero_serie: asset?.numero_serie ?? "",
    admin_local: adminLocalParaCampo(asset?.admin_local),
    data_aquisicao: asset?.data_aquisicao ?? "",
    valor_aquisicao: asset?.valor_aquisicao
      ? String(asset.valor_aquisicao).replace(".", ",")
      : "",
    fornecedor: asset?.fornecedor ?? "",
    nota_fiscal: asset?.nota_fiscal ?? "",
    garantia_ate: asset?.garantia_ate ?? "",
    observacao: asset?.observacao ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  // Próximo nº da sequência PAT, sugerido no cadastro de um ativo novo.
  const [sugestao, setSugestao] = useState<string | null>(null);

  useEffect(() => {
    if (editando) return;
    let ativo = true;
    api
      .get("/api/it-assets/proximo-patrimonio")
      .then((res) => {
        if (!ativo) return;
        const s = res.data.sugestao as string;
        setSugestao(s);
        // Preenche só se o usuário ainda não digitou nada.
        setForm((f) => (f.patrimonio ? f : { ...f, patrimonio: s }));
      })
      .catch(() => {
        /* sem sugestão: o campo continua livre */
      });
    return () => {
      ativo = false;
    };
  }, [editando]);

  const tipo = useMemo(
    () => tipos.find((t) => String(t.id) === form.type_id),
    [tipos, form.type_id],
  );

  const set =
    (campo: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marca.trim() && !form.modelo.trim()) {
      toast.error("Informe a marca ou o modelo.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        ...form,
        type_id: Number(form.type_id),
        admin_local:
          form.admin_local === "mantidos"
            ? true
            : form.admin_local === "removidos"
              ? false
              : null,
      };
      const res = editando
        ? await api.put(`/api/it-assets/${asset!.id}`, payload)
        : await api.post("/api/it-assets", payload);
      toast.success(editando ? "Ativo atualizado." : "Ativo cadastrado.");
      onSaved(res.data as Asset);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erro ao salvar o ativo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={editando ? "Editar ativo" : "Novo ativo"}
      className="modal-wide"
    >
      <form onSubmit={handleSubmit} className="modal-body">
        <div className="inv-form-grid">
          <div className="inv-field">
            <label htmlFor="inv-tipo">Tipo</label>
            <select
              id="inv-tipo"
              className="form-select"
              value={form.type_id}
              onChange={set("type_id")}
              required
            >
              {tipos.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-field">
            <label htmlFor="inv-patrimonio">Nº de patrimônio</label>
            <input
              id="inv-patrimonio"
              className="form-input"
              value={form.patrimonio}
              onChange={set("patrimonio")}
              placeholder="Ex.: PAT22 — vazio se ainda não tem"
              maxLength={40}
              aria-describedby={sugestao ? "inv-patrimonio-dica" : undefined}
            />
            {sugestao && (
              <span id="inv-patrimonio-dica" className="inv-field-hint">
                {form.patrimonio.trim().toUpperCase() === sugestao ? (
                  "Próximo número da sequência."
                ) : (
                  <>
                    Próximo da sequência:{" "}
                    <button
                      type="button"
                      className="inv-hint-link"
                      onClick={() => setForm((f) => ({ ...f, patrimonio: sugestao }))}
                    >
                      usar {sugestao}
                    </button>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="inv-field">
            <label htmlFor="inv-marca">Marca</label>
            <input
              id="inv-marca"
              className="form-input"
              list="inv-marcas"
              value={form.marca}
              onChange={set("marca")}
              placeholder="Ex.: Lenovo"
              maxLength={80}
            />
            <datalist id="inv-marcas">
              {sugestoes.marcas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="inv-field">
            <label htmlFor="inv-modelo">Modelo</label>
            <input
              id="inv-modelo"
              className="form-input"
              list="inv-modelos"
              value={form.modelo}
              onChange={set("modelo")}
              placeholder="Ex.: ThinkPad E14"
              maxLength={120}
            />
            <datalist id="inv-modelos">
              {sugestoes.modelos.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="inv-field">
            <label htmlFor="inv-serie">{rotuloNumeroSerie(tipo?.categoria)}</label>
            <input
              id="inv-serie"
              className="form-input"
              value={form.numero_serie}
              onChange={set("numero_serie")}
              maxLength={80}
            />
          </div>

          {tipo?.categoria === "computador" && (
            <div className="inv-field">
              <label htmlFor="inv-admin">Privilégios de admin local</label>
              <select
                id="inv-admin"
                className="form-select"
                value={form.admin_local}
                onChange={set("admin_local")}
              >
                <option value="">Não informado</option>
                <option value="removidos">Removidos</option>
                <option value="mantidos">Mantidos</option>
              </select>
            </div>
          )}

          <div className="inv-field">
            <label>Garantia até</label>
            <DatePicker
              value={form.garantia_ate}
              onChange={(v) => setForm((f) => ({ ...f, garantia_ate: v }))}
              includeWeekends
            />
          </div>
        </div>

        <h3 className="inv-form-section">Aquisição</h3>
        <div className="inv-form-grid">
          <div className="inv-field">
            <label>Data da compra</label>
            <DatePicker
              value={form.data_aquisicao}
              onChange={(v) => setForm((f) => ({ ...f, data_aquisicao: v }))}
              includeWeekends
            />
          </div>

          <div className="inv-field">
            <label htmlFor="inv-valor">Valor (R$)</label>
            <input
              id="inv-valor"
              className="form-input"
              inputMode="decimal"
              value={form.valor_aquisicao}
              onChange={set("valor_aquisicao")}
              placeholder="0,00"
            />
          </div>

          <div className="inv-field">
            <label htmlFor="inv-fornecedor">Fornecedor</label>
            <input
              id="inv-fornecedor"
              className="form-input"
              value={form.fornecedor}
              onChange={set("fornecedor")}
              maxLength={120}
            />
          </div>

          <div className="inv-field">
            <label htmlFor="inv-nf">Nº da nota fiscal</label>
            <input
              id="inv-nf"
              className="form-input"
              value={form.nota_fiscal}
              onChange={set("nota_fiscal")}
              maxLength={60}
            />
          </div>
        </div>

        <div className="inv-field inv-field--full">
          <label htmlFor="inv-obs">Observação</label>
          <textarea
            id="inv-obs"
            className="form-input"
            rows={3}
            value={form.observacao}
            onChange={set("observacao")}
            maxLength={2000}
          />
        </div>

        {!editando && (
          <p className="inv-hint">
            O ativo entra como <strong>Disponível</strong>. Depois de salvar, use
            “Entregar” para vinculá-lo a um colaborador ou setor.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button type="submit" className="form-button" disabled={salvando}>
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AssetFormModal;
