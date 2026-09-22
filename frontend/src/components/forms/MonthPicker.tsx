import React, { useState, useEffect, useCallback, useRef } from "react";
import PickerDropdown from "./PickerDropdown.tsx";

interface MonthPickerProps {
  value: string; // Formato "AAAA-MM"
  onChange: (monthString: string) => void;
  /** id do campo, para o <label htmlFor> da tela que usa o componente. */
  inputId?: string;
}

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * Seleção de MÊS no mesmo padrão do DatePicker do painel: campo com máscara
 * (mm/aaaa), calendário em dropdown e fechamento por clique fora. A grade
 * mostra os 12 meses de um ano em vez dos dias — para escolher competência,
 * escolher um dia seria escolher a mais.
 */
const MonthPicker: React.FC<MonthPickerProps> = ({
  value,
  onChange,
  inputId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? Number(value.split("-")[0]) : new Date().getFullYear(),
  );
  const [inputValue, setInputValue] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);

  // "2026-09" → "09/2026"
  const paraTexto = (mes: string) => {
    if (!mes) return "";
    const [ano, m] = mes.split("-");
    return `${m}/${ano}`;
  };

  // Digitação incompleta some ao fechar: o campo volta para o valor salvo.
  const fechar = useCallback(() => {
    setIsOpen(false);
    setInputValue(paraTexto(value));
  }, [value]);

  // Sincroniza com o valor externo (escolha na grade ou mudança pelo pai).
  useEffect(() => {
    setInputValue(paraTexto(value));
    if (value) setViewYear(Number(value.split("-")[0]));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2, 6);
    setInputValue(val);

    if (val.length === 7) {
      const [mesStr, anoStr] = val.split("/");
      const m = parseInt(mesStr, 10);
      const y = parseInt(anoStr, 10);
      if (m >= 1 && m <= 12 && y >= 1900) {
        onChange(`${y}-${String(m).padStart(2, "0")}`);
        setViewYear(y);
      }
      return;
    }
    if (val === "") onChange("");
  };

  const handleMonthClick = (indice: number) => {
    onChange(`${viewYear}-${String(indice + 1).padStart(2, "0")}`);
    setIsOpen(false);
  };

  const [anoSelecionado, mesSelecionado] = value
    ? value.split("-")
    : ["", ""];

  return (
    <div className="date-picker-wrapper" ref={wrapperRef}>
      <input
        id={inputId}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        className="form-input"
        placeholder="mm/aaaa"
        aria-label="Mês (mm/aaaa)"
        maxLength={7}
      />
      {isOpen && (
        <PickerDropdown
          anchorRef={wrapperRef}
          onRequestClose={fechar}
          className="date-picker-dropdown month-picker-dropdown"
        >
          <div className="date-picker-header">
            <button
              type="button"
              onClick={() => setViewYear((a) => a - 1)}
              aria-label="Ano anterior"
            >
              &lt;
            </button>
            <span>{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((a) => a + 1)}
              aria-label="Próximo ano"
            >
              &gt;
            </button>
          </div>
          <div className="date-picker-grid month-picker-grid">
            {MESES_CURTOS.map((nome, i) => {
              const isSelected =
                Number(anoSelecionado) === viewYear &&
                Number(mesSelecionado) === i + 1;
              return (
                <button
                  type="button"
                  key={nome}
                  className={`date-picker-day month-picker-month${
                    isSelected ? " selected" : ""
                  }`}
                  onClick={() => handleMonthClick(i)}
                >
                  {nome}
                </button>
              );
            })}
          </div>
        </PickerDropdown>
      )}
    </div>
  );
};

export default MonthPicker;
