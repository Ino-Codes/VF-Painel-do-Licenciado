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
          data: { todayLogins: 3, totalInternalUsers: 10, totalLicenciados: 5, totalDownloads: 7, topDownloads: [] },
        })
      : Promise.resolve({
          data: { total: 0, byStatus: {}, byType: [], bySystem: [], daily: [], byWeekdayPeriod: [], monthly: [], byAttendant: [], medianWaitHours: null, startedCount: 0 },
        }),
  );
});

describe("Estatísticas do Sistema", () => {
  it("tem as quatro abas, com Sistema por padrão", async () => {
    abrir("/admin/statistics");
    const abas = Array.from(document.querySelectorAll(".tab-item")).map((b) => b.textContent);
    expect(abas).toEqual(["Sistema", "Central de Chamados", "Eneagrama", "Cursos"]);
    expect(abaAtiva()).toBe("Sistema");
    await screen.findByText("Logins Hoje");
  });

  it("abre na aba indicada na URL (link antigo de Dashboards)", () => {
    abrir("/admin/statistics?aba=eneagrama");
    expect(abaAtiva()).toBe("Eneagrama");
    expect(screen.getByText("painel-eneagrama")).toBeTruthy();
    // Eneagrama não usa os dados da aba Sistema nem dos chamados.
    expect(api.get).not.toHaveBeenCalled();
  });

  it("aba inválida na URL cai em Sistema", async () => {
    abrir("/admin/statistics?aba=xyz");
    expect(abaAtiva()).toBe("Sistema");
    await screen.findByText("Logins Hoje");
  });

  it("trocar de aba atualiza a URL", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Logins Hoje");
    fireEvent.click(screen.getByRole("tab", { name: "Cursos" }));
    expect(urlAtual()).toBe("/admin/statistics?aba=cursos");
    expect(screen.getByText("painel-cursos")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Sistema" }));
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

  it("Atualizar na aba Sistema busca os dados de novo", async () => {
    abrir("/admin/statistics");
    await screen.findByText("Logins Hoje");
    fireEvent.click(screen.getByText("Atualizar"));
    await waitFor(() =>
      expect((api.get as jest.Mock).mock.calls.filter(([u]) => u.endsWith("system-usage")).length).toBe(2),
    );
  });
});
