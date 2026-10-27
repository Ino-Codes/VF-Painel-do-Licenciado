import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminStatistics from "./AdminStatistics.tsx";
import api from "../../api.ts";

// O Jest do CRA não resolve o react-router-dom v7 (só publica via
// "exports"). A tela só usa useSearchParams, então ele é simulado aqui com
// uma URL em memória — o suficiente para testar a aba vinda da URL.
const mockUrl = { search: "" };
jest.mock(
  "react-router-dom",
  () => {
    const R = require("react");
    return {
      useSearchParams: () => {
        const [, forcar] = R.useReducer((n: number) => n + 1, 0);
        const params = new URLSearchParams(mockUrl.search);
        const set = (novo: Record<string, string>) => {
          const q = new URLSearchParams(novo).toString();
          mockUrl.search = q ? `?${q}` : "";
          forcar();
        };
        return [params, set];
      },
    };
  },
  { virtual: true },
);

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("../../components/layout/Menu.tsx", () => () => null);
jest.mock("../../components/layout/Footer.tsx", () => () => null);
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));
// Mesmo objeto a cada render, como o estado real do AuthContext.
const mockUser = { id: 1 };
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));
jest.mock("./HelpdeskCharts.tsx", () => () => <div>graficos-chamados</div>);
jest.mock("./ActivityCharts.tsx", () => () => <div>graficos-atividade</div>);

// Os painéis de Eneagrama e Cursos contam quantas vezes montaram, para
// provar que "Atualizar" os recarrega.
const mockMontagens = { eneagrama: 0, cursos: 0 };
jest.mock("./EnneagramStats.tsx", () => {
  const R = require("react");
  return () => {
    R.useEffect(() => {
      mockMontagens.eneagrama++;
    }, []);
    return <div>painel-eneagrama</div>;
  };
});
jest.mock("./CourseEngagementDash.tsx", () => {
  const R = require("react");
  return () => {
    R.useEffect(() => {
      mockMontagens.cursos++;
    }, []);
    return <div>painel-cursos</div>;
  };
});

const abrir = (url: string) => {
  mockUrl.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  return render(<AdminStatistics />);
};
const urlAtual = () => `/admin/statistics${mockUrl.search}`;

const abaAtiva = () => document.querySelector(".tab-item.active")!.textContent;

beforeEach(() => {
  jest.clearAllMocks();
  mockMontagens.eneagrama = 0;
  mockMontagens.cursos = 0;
  (api.get as jest.Mock).mockImplementation((url: string) =>
    url.endsWith("system-usage")
      ? Promise.resolve({
          data: {
            dias: 90,
            granularidade: "semana",
            publicos: {
              interno: { cadastrados: 10, ativos7: 3, ativosPeriodo: 8, faixas: { ativo30: 6, ativo90: 2, inativo: 1, nunca: 1 } },
              vpartner: { cadastrados: 5, ativos7: 1, ativosPeriodo: 2, faixas: { ativo30: 1, ativo90: 1, inativo: 0, nunca: 3 } },
            },
            usuarios: [],
            serie: [],
            porDiaHora: [],
            acesso: { sucesso: 0, falhas: 0, falhasCadastrados: 0, contasComFalha: 0, falhas2fa: 0, senhasRedefinidas: 0 },
            totalDownloads: 7,
            topDownloads: [],
          },
        })
      : Promise.resolve({
          data: { total: 0, byStatus: {}, byType: [], bySystem: [], daily: [], byWeekdayPeriod: [], monthly: [], byAttendant: [], medianWaitHours: null, startedCount: 0 },
        }),
  );
});

describe("Estatísticas do Painel", () => {
  it("tem as quatro abas, com Atividade por padrão", async () => {
    abrir("/admin/statistics");
    const abas = Array.from(document.querySelectorAll(".tab-item")).map((b) => b.textContent);
    expect(abas).toEqual(["Atividade", "Central de Chamados", "Eneagrama", "Cursos"]);
    expect(abaAtiva()).toBe("Atividade");
    await screen.findByText("Ativos nos últimos 7 dias");
  });

  it("abre na aba indicada na URL (link antigo de Dashboards)", () => {
    abrir("/admin/statistics?aba=eneagrama");
    expect(abaAtiva()).toBe("Eneagrama");
    expect(screen.getByText("painel-eneagrama")).toBeTruthy();
    // Eneagrama não usa os dados da aba Atividade nem dos chamados.
    expect(api.get).not.toHaveBeenCalled();
  });

  it("aba inválida na URL cai em Atividade", async () => {
    abrir("/admin/statistics?aba=xyz");
    expect(abaAtiva()).toBe("Atividade");
    await screen.findByText("Ativos nos últimos 7 dias");
  });

  it("trocar de aba atualiza a URL", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Ativos nos últimos 7 dias");
    fireEvent.click(screen.getByRole("tab", { name: "Cursos" }));
    expect(urlAtual()).toBe("/admin/statistics?aba=cursos");
    expect(screen.getByText("painel-cursos")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Atividade" }));
    expect(urlAtual()).toBe("/admin/statistics");
    await waitFor(() =>
      expect((api.get as jest.Mock).mock.calls.filter(([u]) => u.endsWith("system-usage")).length).toBe(2),
    );
  });

  it("Atualizar recarrega o painel de Eneagrama", () => {
    abrir("/admin/statistics?aba=eneagrama");
    expect(mockMontagens.eneagrama).toBe(1);
    fireEvent.click(screen.getByText("Atualizar"));
    expect(mockMontagens.eneagrama).toBe(2);
  });

  it("cards da Atividade: ativos em 7 dias e ativos no período por público", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Ativos nos últimos 7 dias");
    expect(screen.getByText("de 15 usuários cadastrados")).toBeTruthy();
    expect(screen.getByText("8 ativos nos últimos 90 dias")).toBeTruthy();
    expect(screen.getByText("2 ativos nos últimos 90 dias")).toBeTruthy();
    expect(screen.getByText("graficos-atividade")).toBeTruthy();
  });

  it("trocar o período busca de novo com os dias escolhidos (padrão 90)", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Ativos nos últimos 7 dias");
    expect((api.get as jest.Mock).mock.calls[0][1]).toEqual({ params: { dias: 90 } });
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "30" } });
    await waitFor(() =>
      expect((api.get as jest.Mock).mock.calls.at(-1)[1]).toEqual({ params: { dias: 30 } }),
    );
    await screen.findByText("Ativos nos últimos 7 dias");
  });

  it("Atualizar na aba Atividade busca os dados de novo", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Ativos nos últimos 7 dias");
    fireEvent.click(screen.getByText("Atualizar"));
    await waitFor(() =>
      expect((api.get as jest.Mock).mock.calls.filter(([u]) => u.endsWith("system-usage")).length).toBe(2),
    );
  });
});
