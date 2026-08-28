import React, { useState, useEffect, useRef } from "react";

interface DatePickerProps {
  value: string; // Formato "AAAA-MM-DD"
  onChange: (dateString: string) => void;
  includeWeekends?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  includeWeekends = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Novo estado para controlar o texto do input (dd/mm/aaaa)
  const [inputValue, setInputValue] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Ao fechar, se o input estiver inválido ou incompleto, reseta para o valor salvo
        if (value) {
          setInputValue(value.split("-").reverse().join("/"));
        } else {
          setInputValue("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Sincroniza o input quando o valor externo muda (ex: seleção no calendário)
  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      setCurrentDate(new Date(y, m - 1, d));
      setInputValue(value.split("-").reverse().join("/"));
    } else {
      setInputValue("");
    }
  }, [value]);

  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);
  const firstDayOfMonth = days[0].getDay();

  // Função para lidar com a digitação manual
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ""); // Remove tudo que não for dígito

    // Aplica a máscara dd/mm/aaaa
    if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
    if (val.length > 5) val = val.slice(0, 5) + "/" + val.slice(5, 9); // Limita ano a 4 dígitos

    setInputValue(val);

    // Se a data estiver completa (10 caracteres: 10/10/2024), valida e envia
    if (val.length === 10) {
      const [dayStr, monthStr, yearStr] = val.split("/");
      const d = parseInt(dayStr, 10);
      const m = parseInt(monthStr, 10);
      const y = parseInt(yearStr, 10);

      const dateObj = new Date(y, m - 1, d);

      // Valida se a data existe (ex: impede 31/02)
      const isValidDate =
        dateObj.getFullYear() === y &&
        dateObj.getMonth() === m - 1 &&
        dateObj.getDate() === d;

      if (isValidDate) {
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Verifica a restrição de final de semana
        if (!includeWeekends && isWeekend) {
          // Opcional: Feedback visual de erro poderia ser adicionado aqui
          return;
        }

        // Se válido, chama o onChange e atualiza a view do calendário
        const formattedDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        onChange(formattedDate);
        setCurrentDate(new Date(y, m - 1, 1));
      }
    } else if (val === "") {
      onChange(""); // Permite limpar o campo
    }
  };

  const handleDayClick = (day: Date) => {
    const dayOfWeek = day.getDay();

    if (!includeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return;
    }

    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    const dateString = `${y}-${m}-${d}`;

    onChange(dateString);
    setIsOpen(false);
  };

  const changeMonth = (amount: number) => {
    setCurrentDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1),
    );
  };

  return (
    <div className="date-picker-wrapper" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue} // Usa o estado local controlado
        onChange={handleInputChange} // Nova função de input
        onFocus={() => setIsOpen(true)}
        className="form-input"
        placeholder="dd/mm/aaaa"
        aria-label="Data (dd/mm/aaaa)"
        maxLength={10}
        // readOnly removido
      />
      {isOpen && (
        <div className="date-picker-dropdown">
          <div className="date-picker-header">
            <button type="button" onClick={() => changeMonth(-1)}>
              &lt;
            </button>
            <span>
              {monthNames[month]} {year}
            </span>
            <button type="button" onClick={() => changeMonth(1)}>
              &gt;
            </button>
          </div>
          <div className="date-picker-grid">
            {daysOfWeek.map((day) => (
              <div key={day} className="date-picker-weekday">
                {day}
              </div>
            ))}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isDisabled = !includeWeekends && isWeekend;

              // Verifica seleção comparando strings
              const dayString = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const isSelected = value === dayString;

              return (
                <button
                  type="button"
                  key={day.toString()}
                  className={`date-picker-day ${isDisabled ? "disabled" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => handleDayClick(day)}
                  disabled={isDisabled}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
