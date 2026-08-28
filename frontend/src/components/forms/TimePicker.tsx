import React, { useState, useEffect, useRef, useMemo } from "react";
import { onKeyActivate } from "../../utils/a11y.ts";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

// Mantém apenas dígitos (máx. HHMM) e insere o ":" no formato HH:mm.
const maskTime = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

// Normaliza para um HH:mm válido (horas 0–23, minutos 0–59) ou "" se incompleto.
const clampTime = (t: string): string => {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = Math.min(23, parseInt(m[1], 10));
  const mm = Math.min(59, parseInt(m[2], 10));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Reflete alterações externas do valor (ex.: reset do formulário).
  useEffect(() => {
    setText(value);
  }, [value]);

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 6; h < 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        options.push(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
        );
      }
    }
    return options;
  }, []);

  useEffect(() => {
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

  return (
    <div className="time-picker-wrapper" ref={wrapperRef}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const masked = maskTime(e.target.value);
          setText(masked);
          onChange(masked);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          const clamped = clampTime(text);
          setText(clamped);
          onChange(clamped);
        }}
        className="form-input time-part"
        placeholder="HH:mm"
        aria-label="Horário (HH:mm)"
        required
      />
      {isOpen && (
        <div className="time-picker-dropdown" role="listbox">
          {timeOptions.map((time) => {
            const selectTime = () => {
              setText(time);
              onChange(time);
              setIsOpen(false);
            };
            return (
              <div
                key={time}
                className="time-picker-option"
                role="option"
                aria-selected={text === time}
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={selectTime}
                onKeyDown={onKeyActivate(selectTime)}
              >
                {time}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
