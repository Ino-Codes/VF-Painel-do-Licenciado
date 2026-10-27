import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import EnneagramStats, { EnneagramStatsData } from "./EnneagramStats.tsx";
import api from "../../api.ts";

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("chart.js", () => ({
  Chart: { register: jest.fn(), defaults: { font: {} } },
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {},
  BarElement: {}, Filler: {}, Tooltip: {}, Legend: {},
}));
jest.mock("../../context/ThemeContext.tsx", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const NOMES = [
  "O Perfeccionista", "O Ajudante", "O Realizador", "O Individualista", "O Investigador",
  "O Leal", "O Entusiasta", "O Desafiador", "O Pacificador",
];

// 4 pessoas fizeram (tipos 1, 1, 5, 9); 2 pendentes.
const dados: EnneagramStatsData = {
  tipos: NOMES.map((nome, i) => ({ id: i + 1, nome })),
  aparicoes: [4, 4, 5, 5, 4, 4, 5, 5, 4],
  participacao: { total: 6, concluidos: 4 },
  ultimoTeste: "2026-09-02T12:00:00Z",
  setores: [
    { setor: "Fiscal", total: 3, concluidos: 2 },
    { setor: "TI", total: 2, concluidos: 2 },
    { setor: "Comercial", total: 1, concluidos: 0 },
  ],
  resultados: [
    { userId: 1, nome: "Ana", setor: "Fiscal", tipo: 1, scores: [4, 2, 2, 2, 2, 2, 2, 2, 2], concluidoEm: "2026-05-01T12:00:00Z" },
    { userId: 2, nome: "Bia", setor: "TI", tipo: 1, scores: [4, 0, 2, 2, 4, 2, 2, 2, 2], concluidoEm: "2026-06-01T12:00:00Z" },
    { userId: 3, nome: "Caio", setor: "Fiscal", tipo: 5, scores: [0, 2, 2, 2, 4, 2, 2, 2, 4], concluidoEm: "2026-07-01T12:00:00Z" },
    { userId: 4, nome: "Davi", setor: "TI", tipo: 9, scores: [2, 2, 2, 2, 2, 2, 2, 2, 4], concluidoEm: "2026-09-02T12:00:00Z" },
  ],
  pendentes: [
    { userId: 5, nome: "Edu", setor: "Fiscal" },
    { userId: 6, nome: "Fê", setor: "Comercial" },
  ],
};

const card = (titulo: string) =>
  screen.getByRole("heading", { name: titulo }).closest(".viz-card") as HTMLElement;

const nomesNaLista = () =>
  within(card("Pessoas"))
    .queryAllByRole("row")
    .slice(1)
    .filter((r) => !r.classList.contains("enea-detalhe"))
    .map((r) => r.querySelector("td")!.textContent);

beforeEach(() => {
  (api.get as jest.Mock).mockResolvedValue({ data: dados });
});

describe("Aba Eneagrama", () => {
  it("busca tudo numa rota só (sem depender da permissão do teste)", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/api/admin/analytics/enneagram-stats");
  });

  it("cards: participação, perfil mais comum, tipos presentes e último teste", async () => {
    render(<EnneagramStats />);
    expect(await screen.findByText("4 de 6")).toBeTruthy();
    expect(screen.getByText("67% de quem tem acesso")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "O Perfeccionista" })).toBeTruthy();
    expect(screen.getByText("2 pessoas")).toBeTruthy();
    expect(screen.getByText("3 de 9")).toBeTruthy();
    expect(screen.getByText("sem ninguém: tipos 2, 3, 4, 6, 7, 8")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "02/09/2026" })).toBeTruthy();
  });

  it("distribuição mostra os 9 tipos; tipo sem ninguém não é clicável", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    const linhas = within(card("Distribuição por tipo")).getAllByRole("button");
    expect(linhas).toHaveLength(9);
    expect(linhas[0].textContent).toBe("1O Perfeccionista250%");
    expect((linhas[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("centros de inteligência somam os tipos de cada tríade", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    const c = card("Centros de inteligência");
    // Instintivo = 8, 9, 1 → 3 pessoas; Mental = 5, 6, 7 → 1; Emocional → 0.
    expect(within(c).getByText("Instintivo").nextSibling!.textContent).toBe("3 · 75%");
    expect(within(c).getByText("Mental").nextSibling!.textContent).toBe("1 · 25%");
    expect(within(c).getByText("Emocional").nextSibling!.textContent).toBe("0 · 0%");
  });

  it("perfil médio usa a % de escolha (pontos ÷ vezes que o tipo aparece)", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    const valores = Array.from(
      card("Perfil médio da equipe").querySelectorAll(".viz-barras-value strong"),
    ).map((e) => e.textContent);
    // Tipo 1: (4/4 + 4/4 + 0/4 + 2/4) / 4 = 62,5% → 63%; tipo 9: (2+2+4+4)/4/4 = 75%.
    expect(valores[0]).toBe("63%");
    expect(valores[8]).toBe("75%");
  });

  it("clicar num setor abre a lista de quem falta nele", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    expect(nomesNaLista()).toEqual(["Ana", "Bia", "Caio", "Davi"]);
    fireEvent.click(within(card("Participação por setor")).getByTitle("Ver quem falta em Fiscal"));
    expect(nomesNaLista()).toEqual(["Edu"]);
    expect((screen.getByLabelText("Situação") as HTMLSelectElement).value).toBe("pendentes");
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).disabled).toBe(true);
    // Setor completo leva aos resultados.
    fireEvent.click(within(card("Participação por setor")).getByTitle("Ver resultados de TI"));
    expect(nomesNaLista()).toEqual(["Bia", "Davi"]);
  });

  it("clicar num tipo filtra quem tem esse tipo", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    fireEvent.click(within(card("Distribuição por tipo")).getAllByRole("button")[0]);
    expect(nomesNaLista()).toEqual(["Ana", "Bia"]);
  });

  it("filtro 'Todos' junta concluídos e pendentes em ordem alfabética", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "todos" } });
    expect(nomesNaLista()).toEqual(["Ana", "Bia", "Caio", "Davi", "Edu", "Fê"]);
    expect(screen.getAllByText("Ainda não fez")).toHaveLength(2);
  });

  it("clicar no nome abre as pontuações da pessoa nos 9 tipos", async () => {
    render(<EnneagramStats />);
    await screen.findByText("Perfil mais comum");
    const botao = screen.getByRole("button", { name: "Caio" });
    fireEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    const detalhe = document.querySelector(".enea-detalhe") as HTMLElement;
    const valores = Array.from(detalhe.querySelectorAll(".viz-barras-value")).map((e) => e.textContent);
    expect(valores[4]).toBe("100%4 de 4");
    expect(valores[8]).toBe("100%4 de 4");
    expect(valores[0]).toBe("0%0 de 4");
    fireEvent.click(botao);
    expect(document.querySelector(".enea-detalhe")).toBeNull();
  });

  it("resposta no formato antigo mostra a mensagem em vez de quebrar a página", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { typeCounts: [], completedUsers: [], collaboratorStats: { total: 1, completed: 0 } },
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    render(<EnneagramStats />);
    expect(await screen.findByText(/Não foi possível carregar os dados/)).toBeTruthy();
  });

  it("erro ao carregar mostra a mensagem", async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error("x"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    render(<EnneagramStats />);
    expect(await screen.findByText(/Não foi possível carregar os dados/)).toBeTruthy();
  });
});
