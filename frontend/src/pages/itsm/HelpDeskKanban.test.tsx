import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import HelpDeskKanban from "./HelpDeskKanban.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";

// O Jest do CRA não resolve o react-router-dom v7 (só via "exports").
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), {
  virtual: true,
});
jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock("../../components/layout/Menu.tsx", () => () => null);
jest.mock("../../components/layout/Footer.tsx", () => () => null);
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

const base = {
  tenant_id: 1,
  tenant_name: "WhatsApp",
  name: "Ana",
  description: "",
  origin_url: "whatsapp",
  created_at: "2026-11-01T12:00:00Z",
  attendant_id: null,
  attendant_name: null,
  resolution_notes: null,
  requester_email: "ana@x.com",
  observation: null,
  attachments: [],
};

const novo = { ...base, id: 1, title: "Impressora parada", status: "novo", type: null };
const emAndamento = {
  ...base,
  id: 2,
  title: "Sem acesso ao ERP",
  status: "andamento",
  type: "duvida",
  attendant_id: 9,
  attendant_name: "Igor",
  classified_by_name: "Igor",
};
const antigoPausado = { ...base, id: 3, title: "Relatório", status: "pausado", type: "help", attendant_id: 9, attendant_name: "Igor" };

beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/api/tickets" ? [novo, emAndamento, antigoPausado] : [] }),
  );
});

const abrir = async (titulo: string) => {
  render(<HelpDeskKanban />);
  fireEvent.click(await screen.findByText(titulo));
};

describe("Central de Chamados — classificação pelo atendente", () => {
  it("chamado em Novo aparece como 'A classificar'", async () => {
    render(<HelpDeskKanban />);
    const card = (await screen.findByText("Impressora parada")).closest(".ticket-card") as HTMLElement;
    expect(within(card).getByText("A classificar")).toBeTruthy();
  });

  it("iniciar o atendimento exige escolher a classificação e a envia", async () => {
    (api.patch as jest.Mock).mockResolvedValue({
      data: { ...novo, status: "andamento", type: "bug", attendant_id: 1, attendant_name: "Eu", classified_by_name: "Eu" },
    });
    await abrir("Impressora parada");
    const iniciar = screen.getByRole("button", { name: /Iniciar atendimento/ });
    expect((iniciar as HTMLButtonElement).disabled).toBe(true);

    const opcoes = screen.getAllByRole("radio");
    expect(opcoes.map((o) => o.querySelector("strong")!.textContent)).toEqual([
      "Bug", "Dúvida", "Solicitação", "Melhoria", "Acesso",
    ]);
    fireEvent.click(screen.getByRole("radio", { name: /Bug/ }));
    expect(screen.getByRole("radio", { name: /Bug/ }).getAttribute("aria-checked")).toBe("true");
    expect((iniciar as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(iniciar);
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/tickets/1/attend", { type: "bug" }),
    );
    // Depois de iniciar, vira o seletor de reclassificação.
    expect(await screen.findByLabelText("Classificação")).toBeTruthy();
  });

  it("reclassificar durante o atendimento chama a rota de classificação", async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { ...emAndamento, type: "acesso" } });
    await abrir("Sem acesso ao ERP");
    const select = screen.getByLabelText("Classificação") as HTMLSelectElement;
    expect(select.value).toBe("duvida");
    expect(screen.getByText("Classificado por Igor")).toBeTruthy();
    fireEvent.change(select, { target: { value: "acesso" } });
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/tickets/2/classificacao", { type: "acesso" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Chamado reclassificado como Acesso.");
  });

  it("tipo antigo aparece como '(antigo)' e não é oferecido de novo", async () => {
    await abrir("Relatório");
    const select = screen.getByLabelText("Classificação") as HTMLSelectElement;
    expect(select.value).toBe("help");
    const antiga = within(select).getByText("Ajuda (antigo)") as HTMLOptionElement;
    expect(antiga.disabled).toBe(true);
    expect(within(select).queryByText("Sugestão")).toBeNull();
  });

  it("erro do servidor aparece para o atendente", async () => {
    (api.patch as jest.Mock).mockRejectedValue({
      response: { data: { error: "Chamado concluído: a classificação não pode mais ser alterada." } },
    });
    await abrir("Sem acesso ao ERP");
    fireEvent.change(screen.getByLabelText("Classificação"), { target: { value: "bug" } });
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Chamado concluído: a classificação não pode mais ser alterada.",
      ),
    );
  });

  it("filtro de tipo tem 'A classificar', os novos tipos e os antigos à parte", async () => {
    render(<HelpDeskKanban />);
    await screen.findByText("Impressora parada");
    const filtro = screen.getByLabelText("Tipo de Chamado") as HTMLSelectElement;
    const valores = Array.from(filtro.options).map((o) => o.value);
    expect(valores).toEqual(["", "sem_tipo", "bug", "duvida", "solicitacao", "melhoria", "acesso", "help", "suggestion"]);
    fireEvent.change(filtro, { target: { value: "sem_tipo" } });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/api/tickets", { params: { type: "sem_tipo" } }),
    );
  });
});
