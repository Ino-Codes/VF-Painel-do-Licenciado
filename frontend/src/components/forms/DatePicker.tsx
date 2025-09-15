import React, { useState, useEffect, useRef } from "react";

interface DatePickerProps {
  value: string; // Formato "AAAA-MM-DD"
  onChange: (dateString: string) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fecha o calendário se o usuário clicar fora dele
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Atualiza o mês exibido se a data selecionada mudar
    if (value) {
      setCurrentDate(new Date(value + "T12:00:00"));
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

  const handleDayClick = (day: Date) => {
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Bloqueia Sábado e Domingo
      return;
    }
    const dateString = day.toISOString().split("T")[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const changeMonth = (amount: number) => {
    setCurrentDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1)
    );
  };

  return (
    <div className="date-picker-wrapper" ref={wrapperRef}>
      <input
        type="text"
        value={
          value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : ""
        }
        onFocus={() => setIsOpen(true)}
        className="form-input"
        placeholder="dd/mm/aaaa"
        readOnly
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
              const isSelected = value === day.toISOString().split("T")[0];
              return (
                <button
                  type="button"
                  key={day.toString()}
                  className={`date-picker-day ${isWeekend ? "disabled" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => handleDayClick(day)}
                  disabled={isWeekend}
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
