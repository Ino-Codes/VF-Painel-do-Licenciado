import React, { useState, useEffect, useMemo } from "react";
import Select, { StylesConfig, SingleValue } from "react-select";
import api from "../../api.ts";
import toast from "react-hot-toast";
import Modal from "../ui/Modal.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";

interface InternalUser {
  id: number;
  nome: string;
}

interface Setor {
  id: number;
  nome: string;
}

interface OptionType {
  value: number | string;
  label: string;
}

interface PraiseModalProps {
  onClose: () => void;
  onSuccess: (created: any) => void;
}

type TargetType = "user" | "setor";

const MAX_LEN = 500;

const PraiseModal: React.FC<PraiseModalProps> = ({ onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [targetType, setTargetType] = useState<TargetType>("user");
  const [selectedPerson, setSelectedPerson] = useState<OptionType | null>(null);
  const [selectedSetor, setSelectedSetor] = useState<OptionType | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/api/users/internal")
      .then((res) => setInternalUsers(res.data as InternalUser[]))
      .catch(() => toast.error("Não foi possível carregar os colegas."));
    api
      .get("/api/setores")
      .then((res) => setSetores(res.data as Setor[]))
      .catch(() => toast.error("Não foi possível carregar os setores."));
  }, []);

  // Todos os colaboradores internos, inclusive o próprio curador: a apuração
  // vem da urna física, então ele pode ser o destinatário de um elogio.
  const personOptions = useMemo<OptionType[]>(
    () =>
      internalUsers
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((u) => ({ value: u.id, label: u.nome })),
    [internalUsers],
  );

  const setorOptions = useMemo<OptionType[]>(
    () => setores.map((s) => ({ value: s.nome, label: s.nome })),
    [setores],
  );

  // Estilo do react-select alinhado ao tema (claro/escuro).
  const selectStyles = useMemo<StylesConfig<OptionType, false>>(() => {
    const getCssVar = (v: string) =>
      getComputedStyle(document.body).getPropertyValue(v).trim();
    return {
      // .form-row é flex: sem largura fixa o select encolhe/expande conforme
      // o texto digitado. Fixa o container à largura da linha do modal.
      container: (provided) => ({
        ...provided,
        width: "100%",
        minWidth: 0,
      }),
      control: (provided) => ({
        ...provided,
        backgroundColor: getCssVar("--bg-primary"),
        borderColor: getCssVar("--border-strong"),
        boxShadow: "none",
        "&:hover": { borderColor: getCssVar("--border-strong") },
      }),
      menu: (provided) => ({
        ...provided,
        backgroundColor: getCssVar("--bg-secondary"),
      }),
      menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isFocused
          ? getCssVar("--border-color")
          : getCssVar("--bg-secondary"),
        color: getCssVar("--text-primary"),
        cursor: "pointer",
        "&:active": { backgroundColor: getCssVar("--border-strong") },
      }),
      input: (provided) => ({ ...provided, color: getCssVar("--text-primary") }),
      singleValue: (provided) => ({
        ...provided,
        color: getCssVar("--text-primary"),
      }),
      placeholder: (provided) => ({
        ...provided,
        color: getCssVar("--text-secondary"),
      }),
    };
  }, [theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === "user" && !selectedPerson) {
      toast.error("Selecione quem recebeu o elogio.");
      return;
    }
    if (targetType === "setor" && !selectedSetor) {
      toast.error("Selecione o setor que recebeu o elogio.");
      return;
    }
    if (message.trim().length < 3) {
      toast.error("Escreva uma mensagem de elogio.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload =
        targetType === "user"
          ? { recipientId: Number(selectedPerson!.value), message: message.trim() }
          : { recipientSetor: String(selectedSetor!.value), message: message.trim() };
      const res = await api.post("/api/praises", payload);
      toast.success("Elogio registrado como rascunho.");
      onSuccess(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erro ao publicar o elogio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const portalTarget =
    typeof document !== "undefined" ? document.body : undefined;

  return (
    <Modal onClose={onClose} title="Registrar um elogio">
      <form onSubmit={handleSubmit} className="modal-body">
        

        {/* Alvo do elogio: pessoa ou setor */}
        <div className="form-row">
          <div
            className="praise-target-toggle"
            role="group"
            aria-label="Tipo de destinatário"
          >
            <button
              type="button"
              className={`praise-target-btn${
                targetType === "user" ? " praise-target-btn--active" : ""
              }`}
              onClick={() => setTargetType("user")}
            >
              Uma pessoa
            </button>
            <button
              type="button"
              className={`praise-target-btn${
                targetType === "setor" ? " praise-target-btn--active" : ""
              }`}
              onClick={() => setTargetType("setor")}
            >
              Um setor
            </button>
          </div>
        </div>

        {targetType === "user" ? (
          <>
            <div className="form-row">
              <label htmlFor="praise-recipient">Quem recebeu o elogio?</label>
            </div>
            <div className="form-row">
              <Select<OptionType>
                inputId="praise-recipient"
                classNamePrefix="react-select"
                options={personOptions}
                value={selectedPerson}
                onChange={(opt: SingleValue<OptionType>) =>
                  setSelectedPerson(opt)
                }
                styles={selectStyles}
                placeholder="Digite para buscar um colaborador…"
                noOptionsMessage={() => "Nenhum colega encontrado"}
                isClearable
                menuPortalTarget={portalTarget}
                menuPosition="fixed"
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-row">
              <label htmlFor="praise-setor">Qual setor recebeu o elogio?</label>
            </div>
            <div className="form-row">
              <Select<OptionType>
                inputId="praise-setor"
                classNamePrefix="react-select"
                options={setorOptions}
                value={selectedSetor}
                onChange={(opt: SingleValue<OptionType>) =>
                  setSelectedSetor(opt)
                }
                styles={selectStyles}
                placeholder="Digite para buscar um setor…"
                noOptionsMessage={() => "Nenhum setor encontrado"}
                isClearable
                menuPortalTarget={portalTarget}
                menuPosition="fixed"
              />
            </div>
          </>
        )}

        <div className="form-row">
          <label htmlFor="praise-message">Mensagem de reconhecimento</label>
        </div>
        <div className="form-row">
          <textarea
            id="praise-message"
            className="form-input"
            placeholder="Ex.: Obrigado por ajudar o time no fechamento do mês — sua dedicação fez a diferença!"
            rows={4}
            maxLength={MAX_LEN}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <div className="praise-char-count">
          {message.length}/{MAX_LEN}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button type="submit" className="form-button" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar rascunho"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PraiseModal;
