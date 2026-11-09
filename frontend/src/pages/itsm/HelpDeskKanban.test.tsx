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
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
// Usuário logado: id 1. A permissão de assumir é ligada por teste.
const mockPermissoes = new Set(["tickets.view", "tickets.manage"]);
const mockUser = { id: 1, nome: "Eu" };
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({ user: mockUser, hasPermission: (k: string) => mockPermissoes.has(k) }),
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
  attendant_id: 1,
  attendant_name: "Eu",
  classified_by_name: "Igor",
};
const antigoPausado = { ...base, id: 3, title: "Relatório", status: "pausado", type: "help", attendant_id: 1, attendant_name: "Eu" };
const deOutro = { ...base, id: 4, title: "VPN caiu", status: "andamento", type: "bug", attendant_id: 9, attendant_name: "Igor Casaril" };

const linhaDoTempo = [
  { id: "s1", kind: "status", body: null, meta: { de: null, para: "novo" }, user_id: null, user_name: "Ana", created_at: "2026-11-01T12:00:00Z" },
  { id: "s2", kind: "status", body: null, meta: { de: "novo", para: "andamento" }, user_id: 9, user_name: "Igor Casaril", created_at: "2026-11-01T13:00:00Z" },
  { id: "a1", kind: "classificacao", body: null, meta: { type: "bug" }, user_id: 9, user_name: "Igor Casaril", created_at: "2026-11-01T13:00:01Z" },
  { id: "a2", kind: "comentario", body: "Reiniciei o roteador.", meta: {}, user_id: 9, user_name: "Igor Casaril", created_at: "2026-11-01T13:10:00Z" },
  { id: "a3", kind: "comentario", body: "Cliente sem VPN desde ontem", meta: { origem: "observacao" }, user_id: null, user_name: null, created_at: "2026-11-01T13:20:00Z" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissoes.delete("tickets_reassign");
  (api.get as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === "/api/tickets"
          ? [novo, emAndamento, antigoPausado, deOutro]
          : url.endsWith("/timeline")
            ? linhaDoTempo
            : [],
    }),
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
    expect(screen.queryByText(/Só o/)).toBeNull();
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

describe("Central de Chamados — trava do responsável", () => {
  it("chamado de outra pessoa: aviso, sem ações, classificação e resolução travadas", async () => {
    await abrir("VPN caiu");
    expect(screen.getByRole("status").textContent).toContain("Em atendimento por Igor Casaril");
    expect(screen.queryByRole("button", { name: /Concluir atendimento/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pausar atendimento/ })).toBeNull();
    expect((screen.getByLabelText("Classificação") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText(/Descreva os passos/) as HTMLTextAreaElement).disabled).toBe(true);
    // Sem a permissão, não aparece "Assumir".
    expect(screen.queryByRole("button", { name: "Assumir atendimento" })).toBeNull();
    // Comentar continua liberado.
    expect(screen.getByLabelText("Novo comentário")).toBeTruthy();
  });

  it("card mostra as iniciais de quem está atendendo", async () => {
    render(<HelpDeskKanban />);
    const card = (await screen.findByText("VPN caiu")).closest(".ticket-card") as HTMLElement;
    expect(within(card).getByLabelText("Em atendimento por Igor Casaril").textContent).toBe("IC");
  });

  it("com a permissão, assume o atendimento informando o motivo", async () => {
    mockPermissoes.add("tickets_reassign");
    (api.post as jest.Mock).mockResolvedValue({ data: { ...deOutro, attendant_id: 1, attendant_name: "Eu" } });
    await abrir("VPN caiu");
    fireEvent.click(screen.getByRole("button", { name: "Assumir atendimento" }));
    fireEvent.change(screen.getByLabelText("Motivo (opcional)"), { target: { value: "Igor de férias" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/tickets/4/assumir", { motivo: "Igor de férias" }),
    );
    // Virou o responsável: o aviso some e as ações aparecem.
    expect(await screen.findByRole("button", { name: /Concluir atendimento/ })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ação recusada (409) mostra o motivo e recarrega o chamado", async () => {
    (api.patch as jest.Mock).mockRejectedValue({
      response: { status: 409, data: { error: "Igor Casaril já iniciou este atendimento." } },
    });
    await abrir("Impressora parada");
    fireEvent.click(screen.getByRole("radio", { name: /Bug/ }));
    const buscas = () => (api.get as jest.Mock).mock.calls.filter(([u]) => u === "/api/tickets").length;
    const antes = buscas();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar atendimento/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Igor Casaril já iniciou este atendimento."),
    );
    await waitFor(() => expect(buscas()).toBe(antes + 1));
  });
});

describe("Central de Chamados — linha do tempo", () => {
  it("mostra eventos e comentários, inclusive a observação antiga", async () => {
    await abrir("VPN caiu");
    expect(await screen.findByText("Reiniciei o roteador.")).toBeTruthy();
    const lista = document.querySelector(".ticket-timeline-lista") as HTMLElement;
    const textos = Array.from(lista.querySelectorAll("li")).map((li) => li.textContent);
    expect(textos[0]).toContain("Chamado aberto por Ana");
    expect(textos[1]).toContain("Igor Casaril iniciou o atendimento");
    expect(textos[2]).toContain("Igor Casaril classificou como Bug");
    expect(within(lista).getByText("Observação anterior")).toBeTruthy();
    expect(within(lista).getByText("Cliente sem VPN desde ontem")).toBeTruthy();
  });

  it("comentar acrescenta ao fim, sem apagar nada", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: "a9", kind: "comentario", body: "Vou acompanhar.", meta: {}, user_id: 1, user_name: "Eu", created_at: "2026-11-02T10:00:00Z" },
    });
    await abrir("VPN caiu");
    await screen.findByText("Reiniciei o roteador.");
    const caixa = screen.getByLabelText("Novo comentário");
    fireEvent.change(caixa, { target: { value: "  Vou acompanhar.  " } });
    fireEvent.keyDown(caixa, { key: "Enter", ctrlKey: true });
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/tickets/4/comentarios", { texto: "Vou acompanhar." }),
    );
    expect(await screen.findByText("Vou acompanhar.")).toBeTruthy();
    expect(screen.getByText("Reiniciei o roteador.")).toBeTruthy();
    expect((caixa as HTMLTextAreaElement).value).toBe("");
  });
});
