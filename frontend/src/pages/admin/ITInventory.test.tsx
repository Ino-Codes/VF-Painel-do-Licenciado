import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import ITInventory from "./ITInventory.tsx";
import api from "../../api.ts";

// A tela conversa só com a API; o resto do layout não interessa aqui.
jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../components/layout/Menu.tsx", () => () => null);
jest.mock("../../components/layout/Footer.tsx", () => () => null);
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

let mockPermissoes: string[] = [];
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({ hasPermission: (k: string) => mockPermissoes.includes(k) }),
}));
jest.mock("../../context/ThemeContext.tsx", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const base = {
  tipo_nome: "Notebook",
  categoria: "computador",
  numero_serie: null,
  admin_local: false,
  setor_id: null,
  responsavel_foto: null,
  data_aquisicao: null,
  valor_aquisicao: null,
  fornecedor: null,
  nota_fiscal: null,
  garantia_ate: null,
  observacao: null,
  type_id: 1,
};

const ATIVOS = [
  {
    ...base,
    id: 1,
    patrimonio: "000078",
    marca: "Lenovo",
    modelo: "T14",
    status: "em_uso",
    user_id: 7,
    responsavel_nome: "Ana Souza",
    responsavel_desde: "2026-09-01",
    setor_nome: "Comercial",
    compartilhado: false,
  },
  {
    ...base,
    id: 2,
    patrimonio: "000010",
    marca: "Vaio",
    modelo: null,
    status: "disponivel",
    user_id: null,
    responsavel_nome: null,
    responsavel_desde: null,
    setor_nome: null,
    compartilhado: false,
  },
  {
    ...base,
    id: 3,
    tipo_nome: "Celular",
    categoria: "movel",
    type_id: 2,
    patrimonio: null,
    marca: "Samsung",
    modelo: "A25",
    status: "em_uso",
    user_id: null,
    setor_id: 1,
    responsavel_nome: null,
    responsavel_desde: "2026-08-01",
    setor_nome: "Auditoria",
    compartilhado: true,
  },
];

const DETALHE = {
  ...ATIVOS[0],
  eventos: [
    {
      id: 2,
      tipo: "entrega",
      colaborador_nome: "Ana Souza",
      setor_nome: null,
      detalhes: "Com carregador",
      data_evento: "2026-09-01",
      feito_por_nome: "Inácio",
      created_at: "2026-09-01T12:00:00Z",
    },
    {
      id: 1,
      tipo: "cadastro",
      colaborador_nome: null,
      setor_nome: null,
      detalhes: null,
      data_evento: "2026-08-20",
      feito_por_nome: "Inácio",
      created_at: "2026-08-20T12:00:00Z",
    },
  ],
};

const mockGet = api.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockPermissoes = ["it_assets.view", "it_assets.manage"];
  mockGet.mockImplementation((url: string) => {
    if (url === "/api/it-assets")
      return Promise.resolve({
        data: {
          assets: ATIVOS,
          kpis: { total: 3, em_uso: 2, disponiveis: 1, manutencao: 0 },
        },
      });
    if (url === "/api/it-assets/proximo-patrimonio") return Promise.resolve({ data: { sugestao: "PAT22" } });
    if (url === "/api/it-assets/types")
      return Promise.resolve({
        data: [
          { id: 1, nome: "Notebook", categoria: "computador" },
          { id: 2, nome: "Celular", categoria: "movel" },
        ],
      });
    if (url === "/api/it-assets/1") return Promise.resolve({ data: DETALHE });
    if (url === "/api/setores") return Promise.resolve({ data: [{ id: 1, nome: "Auditoria" }] });
    if (url === "/api/users/internal") return Promise.resolve({ data: [{ id: 7, nome: "Ana Souza" }] });
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
});

const linhas = () => document.querySelectorAll("tbody tr.inv-row");

describe("Inventário de TI", () => {
  it("mostra indicadores, abas dos tipos e as linhas da tabela", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));

    const kpis = document.querySelector(".inv-kpis") as HTMLElement;
    expect(kpis.querySelectorAll(".stat-card").length).toBe(4);
    expect(within(kpis).getByText("Em uso").previousSibling!.textContent).toBe("2");
    expect(within(kpis).queryByText("Sem patrimônio")).toBeNull();
    expect(screen.getByRole("tab", { name: "Notebook" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Celular" })).toBeTruthy();

    // Pessoa, compartilhado e sem responsável.
    expect(screen.getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Compartilhado")).toBeTruthy();
    expect(screen.getByText("Sem patrimônio", { selector: ".inv-muted" })).toBeTruthy();
  });

  it("ação rápida muda conforme o status", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    // Ordenadas por patrimônio: 000010 (disponível), 000078 (em uso).
    const [disponivel, emUso] = Array.from(linhas());
    expect(within(emUso as HTMLElement).getByText("Devolver")).toBeTruthy();
    expect(within(disponivel as HTMLElement).getByText("Entregar")).toBeTruthy();
  });

  it("ordena por patrimônio e inverte no segundo clique", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    const primeira = () => linhas()[0].querySelector("td")!.textContent;
    expect(primeira()).toBe("000010");
    fireEvent.click(screen.getByText(/^Patrimônio/, { selector: "th" }));
    expect(primeira()).toBe("Sem patrimônio");
  });

  it("aba de tipo refaz a busca filtrando pelo tipo", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    fireEvent.click(screen.getByRole("tab", { name: "Celular" }));
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/it-assets",
        expect.objectContaining({ params: expect.objectContaining({ tipo: 2 }) }),
      ),
    );
  });

  it("sem it_assets.manage: sem botão de novo ativo nem coluna de ações", async () => {
    mockPermissoes = ["it_assets.view"];
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    expect(screen.queryByText("Novo ativo")).toBeNull();
    expect(screen.queryByText("Ações")).toBeNull();
    expect(screen.queryByText("Devolver")).toBeNull();
  });

  it("clicar na linha abre o detalhe com histórico e ações do status", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    fireEvent.click(linhas()[1]); // 000078, em uso (ordenado por patrimônio)

    await waitFor(() => expect(document.querySelector(".inv-history")).not.toBeNull());
    const historico = document.querySelector(".inv-history")!;
    expect(historico.querySelectorAll("li").length).toBe(2);
    expect(historico.textContent).toContain("Entregue para Ana Souza");
    expect(historico.textContent).toContain("Com carregador");
    expect(historico.textContent).toContain("01/09/2026 · registrado por Inácio");

    const acoes = document.querySelector(".inv-detail-actions")!.textContent;
    expect(acoes).toContain("Devolver");
    expect(acoes).toContain("Transferir");
    expect(acoes).not.toContain("Entregar");
    // Tem movimentação: não pode excluir.
    expect(acoes).not.toContain("Excluir");
  });

  it("devolução com defeito envia a condição para a API", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { ...ATIVOS[0], status: "manutencao" } });
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    fireEvent.click(within(linhas()[1] as HTMLElement).getByText("Devolver"));

    fireEvent.click(await screen.findByLabelText(/Com defeito/));
    const modal = document.querySelector(".modal-content") as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Devolver" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/api/it-assets/1/devolver",
        expect.objectContaining({ condicao: "defeito" }),
      ),
    );
  });

  it("entregar sem escolher o responsável não chama a API", async () => {
    render(<ITInventory />);
    await waitFor(() => expect(linhas().length).toBe(3));
    fireEvent.click(within(linhas()[0] as HTMLElement).getByText("Entregar"));
    await screen.findByText("Entregar equipamento");
    const modal = document.querySelector(".modal-content") as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Entregar" }));
    expect(api.post).not.toHaveBeenCalled();
  });

  describe("sugestão de patrimônio no cadastro", () => {
    const abrirNovo = async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(3));
      fireEvent.click(screen.getByText("Novo ativo"));
      return (await screen.findByLabelText("Nº de patrimônio")) as HTMLInputElement;
    };

    it("já vem preenchido com o próximo da sequência", async () => {
      const campo = await abrirNovo();
      await waitFor(() => expect(campo.value).toBe("PAT22"));
      expect(screen.getByText("Próximo número da sequência.")).toBeTruthy();
    });

    it("se o usuário trocar, oferece voltar para a sugestão", async () => {
      const campo = await abrirNovo();
      await waitFor(() => expect(campo.value).toBe("PAT22"));
      fireEvent.change(campo, { target: { value: "000200" } });
      fireEvent.click(screen.getByText("usar PAT22"));
      expect(campo.value).toBe("PAT22");
    });

    it("na edição não sugere nem troca o patrimônio", async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(3));
      fireEvent.click(screen.getAllByLabelText(/^Editar /)[0]);
      const campo = (await screen.findByLabelText("Nº de patrimônio")) as HTMLInputElement;
      expect(campo.value).toBe("000010");
      expect(mockGet).not.toHaveBeenCalledWith("/api/it-assets/proximo-patrimonio");
      expect(screen.queryByText(/sequência/)).toBeNull();
    });
  });

  describe("paginação", () => {
    // 30 notebooks disponíveis, patrimônios 000001 a 000030.
    const MUITOS = Array.from({ length: 30 }, (_, i) => ({
      ...ATIVOS[1],
      id: 100 + i,
      patrimonio: String(i + 1).padStart(6, "0"),
    }));

    beforeEach(() => {
      const original = mockGet.getMockImplementation()!;
      mockGet.mockImplementation((url: string, cfg?: any) =>
        url === "/api/it-assets"
          ? Promise.resolve({
              data: {
                assets: MUITOS,
                kpis: { total: 30, em_uso: 0, disponiveis: 30, manutencao: 0 },
              },
            })
          : original(url, cfg),
      );
    });

    it("mostra 25 por padrão, com contagem e páginas", async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(25));
      expect(screen.getByText("1–25 de 30 ativos")).toBeTruthy();
      expect(screen.getByText("Página 1 de 2")).toBeTruthy();
      expect((screen.getByText("Anterior") as HTMLButtonElement).disabled).toBe(true);
    });

    it("avança e volta de página", async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(25));
      fireEvent.click(screen.getByText("Próxima"));
      expect(linhas().length).toBe(5);
      expect(linhas()[0].querySelector("td")!.textContent).toBe("000026");
      expect(screen.getByText("26–30 de 30 ativos")).toBeTruthy();
      expect((screen.getByText("Próxima") as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByText("Anterior"));
      expect(linhas()[0].querySelector("td")!.textContent).toBe("000001");
    });

    it("trocar o limite volta para a página 1 e fica salvo", async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(25));
      fireEvent.click(screen.getByText("Próxima"));
      fireEvent.change(screen.getByLabelText("Itens por página"), { target: { value: "10" } });
      expect(linhas().length).toBe(10);
      expect(screen.getByText("Página 1 de 3")).toBeTruthy();
      expect(localStorage.getItem("inventario-ti:por-pagina")).toBe("10");
    });

    it("usa o limite salvo ao abrir a tela", async () => {
      localStorage.setItem("inventario-ti:por-pagina", "50");
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(30));
      expect(screen.getByText("Página 1 de 1")).toBeTruthy();
    });

    it("mudar a ordenação volta para a página 1", async () => {
      render(<ITInventory />);
      await waitFor(() => expect(linhas().length).toBe(25));
      fireEvent.click(screen.getByText("Próxima"));
      fireEvent.click(screen.getByText(/^Patrimônio/, { selector: "th" }));
      expect(screen.getByText("Página 1 de 2")).toBeTruthy();
      expect(linhas()[0].querySelector("td")!.textContent).toBe("000030");
    });
  });
});
