import React, { useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MonthPicker from "./MonthPicker.tsx";

// Simula o que acontecia no modal: um contêiner com rolagem própria em volta
// do campo. O painel NÃO pode ser descendente dele, senão volta a ser
// recortado pela rolagem.
const ComModalFalso: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={modalRef} data-testid="modal" className="modal-content">
      <MonthPicker inputId="mes" value={value} onChange={onChange} />
    </div>
  );
};

describe("MonthPicker", () => {
  it("abre o painel fora do modal (portal no body)", () => {
    render(<ComModalFalso value="2026-09" onChange={() => {}} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));

    const painel = document.querySelector(".picker-portal");
    const modal = screen.getByTestId("modal");

    expect(painel).not.toBeNull();
    expect(modal.contains(painel as Node)).toBe(false);
    expect(painel!.parentElement).toBe(document.body);
  });

  it("mostra os 12 meses e marca o mês do valor", () => {
    render(<ComModalFalso value="2026-09" onChange={() => {}} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));

    const meses = document.querySelectorAll(".month-picker-month");
    expect(meses.length).toBe(12);
    expect(document.querySelector(".month-picker-month.selected")!.textContent)
      .toBe("Set");
  });

  it("devolve a competência escolhida no formato YYYY-MM", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="2026-09" onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));

    fireEvent.click(screen.getByText("Mar"));
    expect(onChange).toHaveBeenCalledWith("2026-03");
  });

  it("navega de ano sem mudar o valor", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="2026-09" onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));

    fireEvent.click(screen.getByLabelText("Ano anterior"));
    expect(screen.getByText("2025")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Dez"));
    expect(onChange).toHaveBeenCalledWith("2025-12");
  });

  it("aceita a digitação com máscara mm/aaaa", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="" onChange={onChange} />);
    const campo = screen.getByLabelText("Mês (mm/aaaa)") as HTMLInputElement;

    fireEvent.change(campo, { target: { value: "072026" } });
    expect(campo.value).toBe("07/2026");
    expect(onChange).toHaveBeenCalledWith("2026-07");
  });

  it("ignora mês inexistente digitado", () => {
    const onChange = jest.fn();
    render(<ComModalFalso value="" onChange={onChange} />);
    const campo = screen.getByLabelText("Mês (mm/aaaa)") as HTMLInputElement;

    fireEvent.change(campo, { target: { value: "132026" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicar dentro do painel não o fecha; clicar fora fecha", () => {
    render(<ComModalFalso value="2026-09" onChange={() => {}} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));

    // Clique no cabeçalho do painel (que vive no body) deve mantê-lo aberto.
    fireEvent.mouseDown(screen.getByLabelText("Próximo ano"));
    expect(document.querySelector(".picker-portal")).not.toBeNull();

    fireEvent.mouseDown(document.body);
    expect(document.querySelector(".picker-portal")).toBeNull();
  });

  it("fecha com Esc", () => {
    render(<ComModalFalso value="2026-09" onChange={() => {}} />);
    fireEvent.focus(screen.getByLabelText("Mês (mm/aaaa)"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".picker-portal")).toBeNull();
  });
});
