import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TicketRating from "./TicketRating.tsx";

const estrela = (n: number) => screen.getByRole("radio", { name: new RegExp(`^${n} de 5`) });
const enviar = () => screen.getByRole("button", { name: "Enviar avaliação" }) as HTMLButtonElement;

describe("Avaliação do atendimento", () => {
  it("botão só habilita depois de escolher a nota", () => {
    render(<TicketRating avaliacao={null} onAvaliar={jest.fn()} />);
    expect(enviar().disabled).toBe(true);
    expect(screen.queryByLabelText(/Quer contar mais/)).toBeNull();
    fireEvent.click(estrela(4));
    expect(enviar().disabled).toBe(false);
    expect(estrela(4).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Bom")).toBeTruthy();
    // O comentário opcional aparece depois da nota.
    expect(screen.getByLabelText(/Quer contar mais/)).toBeTruthy();
  });

  it("envia nota e comentário aparado", async () => {
    const onAvaliar = jest.fn().mockResolvedValue(undefined);
    render(<TicketRating avaliacao={null} onAvaliar={onAvaliar} />);
    fireEvent.click(estrela(5));
    fireEvent.change(screen.getByLabelText(/Quer contar mais/), { target: { value: "  Muito rápido!  " } });
    fireEvent.click(enviar());
    await waitFor(() => expect(onAvaliar).toHaveBeenCalledWith(5, "Muito rápido!"));
  });

  it("estrela clicada no e-mail já vem selecionada", () => {
    render(<TicketRating avaliacao={null} onAvaliar={jest.fn()} notaInicial={2} />);
    expect(estrela(2).getAttribute("aria-checked")).toBe("true");
    expect(enviar().disabled).toBe(false);
  });

  it("nota inválida na URL é ignorada", () => {
    render(<TicketRating avaliacao={null} onAvaliar={jest.fn()} notaInicial={9} />);
    expect(enviar().disabled).toBe(true);
  });

  it("setas do teclado mudam a nota", () => {
    render(<TicketRating avaliacao={null} onAvaliar={jest.fn()} notaInicial={3} />);
    fireEvent.keyDown(estrela(3), { key: "ArrowRight" });
    expect(estrela(4).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(estrela(4), { key: "ArrowLeft" });
    fireEvent.keyDown(estrela(3), { key: "ArrowLeft" });
    expect(estrela(2).getAttribute("aria-checked")).toBe("true");
    // Só a escolhida entra no Tab.
    expect(estrela(2).tabIndex).toBe(0);
    expect(estrela(5).tabIndex).toBe(-1);
  });

  it("mostra o erro do servidor", async () => {
    const onAvaliar = jest.fn().mockRejectedValue({ response: { data: { error: "Este chamado já foi avaliado. Obrigado!" } } });
    render(<TicketRating avaliacao={null} onAvaliar={onAvaliar} />);
    fireEvent.click(estrela(1));
    fireEvent.click(enviar());
    expect((await screen.findByRole("alert")).textContent).toContain("já foi avaliado");
  });

  it("já avaliado: só exibe, sem formulário", () => {
    render(
      <TicketRating
        avaliacao={{ nota: 4, comentario: "Resolveu rápido", data: "2026-10-14T12:00:00Z" }}
        onAvaliar={jest.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: "4 de 5 estrelas" })).toBeTruthy();
    expect(screen.getByText("“Resolveu rápido”")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("sem permissão para avaliar por aqui: explica onde avaliar", () => {
    render(<TicketRating avaliacao={null} />);
    expect(screen.getByText(/link enviado no e-mail de conclusão/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
