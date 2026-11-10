import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ActivityCharts, { ActivityStats } from "./ActivityCharts.tsx";

// Canvas não existe no jsdom: os gráficos de linha viram um marcador com os
// dados recebidos, para conferir o que seria desenhado.
jest.mock("react-chartjs-2", () => ({
  Line: ({ data }: any) => (
    <div data-testid="linha">{data.datasets.map((d: any) => `${d.label}=${d.data.join(",")}`).join(" | ")}</div>
  ),
}));
jest.mock("chart.js", () => ({
  Chart: { register: jest.fn(), defaults: { font: {} } },
  CategoryScale: {}, LinearScale: {}, PointElement: {}, LineElement: {},
  BarElement: {}, Filler: {}, Tooltip: {}, Legend: {},
}));
jest.mock("../../context/ThemeContext.tsx", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const stats: ActivityStats = {
  dias: 90,
  granularidade: "semana",
  publicos: {
    interno: { cadastrados: 4, ativos7: 1, ativosPeriodo: 3, faixas: { ativo30: 2, ativo90: 1, inativo: 0, nunca: 1 } },
    vpartner: { cadastrados: 2, ativos7: 0, ativosPeriodo: 0, faixas: { ativo30: 0, ativo90: 0, inativo: 1, nunca: 1 } },
  },
  usuarios: [
    { id: 1, nome: "Ana", email: "ana@x.com", publico: "interno", faixa: "ativo30", ultimoLogin: "2026-10-20T12:00:00Z" },
    { id: 2, nome: "Bruno", email: "bruno@x.com", publico: "interno", faixa: "ativo30", ultimoLogin: "2026-10-21T12:00:00Z" },
    { id: 3, nome: "Carla", email: "carla@x.com", publico: "interno", faixa: "ativo90", ultimoLogin: "2026-09-01T12:00:00Z" },
    { id: 4, nome: "Davi", email: "davi@x.com", publico: "interno", faixa: "nunca", ultimoLogin: null },
    { id: 5, nome: "Eva", email: "eva@x.com", publico: "vpartner", faixa: "inativo", ultimoLogin: "2026-03-10T12:00:00Z" },
    { id: 6, nome: "Fábio", email: "fabio@x.com", publico: "vpartner", faixa: "nunca", ultimoLogin: null },
  ],
  serie: [
    { inicio: "2026-10-12", internos: 3, vpartners: 0, sucesso: 9, falhas: 2, falhasSenha: 1, falhasEmail: 1, falhas2fa: 0, senhasRedefinidas: 1 },
    { inicio: "2026-10-19", internos: 2, vpartners: 1, sucesso: 5, falhas: 0, falhasSenha: 0, falhasEmail: 0, falhas2fa: 0, senhasRedefinidas: 0 },
  ],
  porDiaHora: [
    { dow: 1, hora: 10, count: 7 },
    { dow: 1, hora: 6, count: 1 },
    { dow: 1, hora: 7, count: 2 },
    { dow: 5, hora: 21, count: 4 },
  ],
  acesso: { sucesso: 14, falhas: 6, falhasCadastrados: 4, contasComFalha: 2, falhas2fa: 0, senhasRedefinidas: 1 },
  totalDownloads: 20,
  topDownloads: [
    { name: "Contrato padrão - honorários", count: 10 },
    { name: "Apresentação Comercial", count: 5 },
  ],
};

describe("Gráficos da aba Atividade", () => {
  it("séries de usuários ativos e de tentativas de login", () => {
    render(<ActivityCharts stats={stats} />);
    const [ativos, acesso] = screen.getAllByTestId("linha");
    expect(ativos.textContent).toBe("Colaboradores=3,2 | V-Partners=0,1");
    expect(acesso.textContent).toBe("Logins concluídos=9,5 | Senha incorreta=1,0 | E-mail não cadastrado=1,0");
    expect(screen.getAllByText("usuários diferentes que entraram, por semana")).toHaveLength(1);
  });

  it("adoção: clicar numa faixa lista quem está nela; clicar de novo fecha", () => {
    render(<ActivityCharts stats={stats} />);
    const nunca = screen.getAllByRole("button", { name: /Nunca acessou/ });
    // Uma legenda por público, na ordem Colaboradores, V-Partners.
    expect(nunca).toHaveLength(2);
    fireEvent.click(nunca[0]);
    let tabela = screen.getByRole("table");
    expect(within(tabela).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([
      "Davidavi@x.com—",
    ]);
    expect(screen.getByText("Colaboradores · Nunca acessou")).toBeTruthy();

    fireEvent.click(nunca[1]);
    tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Fábio")).toBeTruthy();
    expect(within(tabela).queryByText("Davi")).toBeNull();

    fireEvent.click(nunca[1]);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("faixa vazia não é clicável e mostra 0%", () => {
    render(<ActivityCharts stats={stats} />);
    const inativoColab = screen.getAllByRole("button", { name: /Há mais de 90 dias/ })[0];
    expect((inativoColab as HTMLButtonElement).disabled).toBe(true);
    expect(inativoColab.textContent).toContain("0%");
  });

  it("mapa de calor agrupa a madrugada em <8 e a noite em 19+", () => {
    render(<ActivityCharts stats={stats} />);
    expect(screen.getByTitle("Seg, antes das 8h — 3 login(s)").textContent).toBe("3");
    expect(screen.getByTitle("Seg, 10h — 7 login(s)").textContent).toBe("7");
    expect(screen.getByTitle("Sex, a partir das 19h — 4 login(s)").textContent).toBe("4");
    expect(screen.getByTitle("Ter, 10h — 0 login(s)").textContent).toBe("");
  });

  it("resumo da saúde do acesso", () => {
    render(<ActivityCharts stats={stats} />);
    // 6 falhas em 20 tentativas: 4 de senha errada (20%) e 2 de e-mail não cadastrado.
    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("das tentativas com senha incorreta")).toBeTruthy();
    expect(screen.getByText("tentativas com e-mail não cadastrado").previousSibling!.textContent).toBe("2");
    expect(screen.getByText("senha redefinida")).toBeTruthy();
  });

  it("arquivos mais baixados: ranking com barra relativa ao 1º e fatia do total", () => {
    render(<ActivityCharts stats={stats} />);
    expect(screen.getByText("20 downloads no período")).toBeTruthy();
    const itens = document.querySelectorAll(".viz-ranking-item");
    expect(itens).toHaveLength(2);
    expect(itens[0].querySelector(".viz-ranking-name")!.getAttribute("title")).toBe("Contrato padrão - honorários");
    expect(itens[0].querySelector(".viz-ranking-value")!.textContent).toBe("1050%");
    expect(itens[1].querySelector(".viz-ranking-value")!.textContent).toBe("525%");
    const larguras = Array.from(itens).map((li) =>
      (li.querySelector(".viz-ranking-bar") as HTMLElement).style.getPropertyValue("--bar-w"),
    );
    expect(larguras).toEqual(["100%", "50%"]);
  });

  it("sem downloads no período", () => {
    render(<ActivityCharts stats={{ ...stats, totalDownloads: 0, topDownloads: [] }} />);
    expect(screen.getByText("Nenhum download no período.")).toBeTruthy();
  });

  it("backend antigo, sem os campos novos, não quebra a tela", () => {
    render(<ActivityCharts stats={{ dias: 90 } as any} />);
    expect(screen.getByText("Nenhum login no período.")).toBeTruthy();
  });
});
