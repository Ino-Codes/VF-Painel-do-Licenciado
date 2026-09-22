import React, { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DatePicker from "./DatePicker.tsx";

const ComModalFalso: React.FC<{
  value: string;
  onChange: (v: string) => void;
  includeWeekends?: boolean;
}> = ({ value, onChange, includeWeekends }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={modalRef} data-testid="modal" className="modal-content">
      <DatePicker
        value={value}
        onChange={onChange}
        includeWeekends={includeWeekends}
      />
    </div>
  );
};

const abrir = () => fireEvent.focus(screen.getByLabelText("Data (dd/mm/aaaa)"));

describe("DatePicker", () => {
  it("abre o calendário fora do modal (portal no body)", () => {
    // 2026-09-15 é uma terça-feira.
    render(<ComModalFalso value="2026-09-15" onChange={() => {}} />);
    abrir();

    const painel = document.querySelector(".picker-portal");
    expect(painel).not.toBeNull();
    expect(screen.getByTestId("modal").contains(painel as Node)).toBe(false);
    expect(painel!.parentElement).toBe(document.body);
  });

  it("mantém o comportamento de escolher um dia", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="2026-09-15" onChange={onChange} />);
    abrir();

    fireEvent.click(screen.getByText("17")); // quinta-feira
    expect(onChange).toHaveBeenCalledWith("2026-09-17");
  });

  it("mantém os fins de semana desabilitados por padrão", () => {
    render(<ComModalFalso value="2026-09-15" onChange={() => {}} />);
    abrir();

    // 2026-09-19 é sábado, 2026-09-20 domingo.
    const dia = (texto: string) =>
      screen.getByText(texto) as HTMLButtonElement;
    expect(dia("19").disabled).toBe(true);
    expect(dia("20").disabled).toBe(true);
    expect(dia("18").disabled).toBe(false);
  });

  it("libera o fim de semana com includeWeekends", () => {
    const onChange = jest.fn();
    render(
      <ComModalFalso value="2026-09-15" onChange={onChange} includeWeekends />,
    );
    abrir();

    fireEvent.click(screen.getByText("19"));
    expect(onChange).toHaveBeenCalledWith("2026-09-19");
  });

  it("clique dentro do calendário não fecha; fora fecha", () => {
    render(<ComModalFalso value="2026-09-15" onChange={() => {}} />);
    abrir();

    fireEvent.mouseDown(screen.getByText("Setembro 2026"));
    expect(document.querySelector(".picker-portal")).not.toBeNull();

    fireEvent.mouseDown(document.body);
    expect(document.querySelector(".picker-portal")).toBeNull();
  });

  it("digitação com máscara continua valendo", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="" onChange={onChange} />);
    const campo = screen.getByLabelText(
      "Data (dd/mm/aaaa)",
    ) as HTMLInputElement;

    fireEvent.change(campo, { target: { value: "17092026" } });
    expect(campo.value).toBe("17/09/2026");
    expect(onChange).toHaveBeenCalledWith("2026-09-17");
  });
});
