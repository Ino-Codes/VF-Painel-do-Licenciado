import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CertificadosCursos from "./CertificadosCursos.tsx";
import api from "../../api.ts";

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));
// O Jest do CRA não resolve o react-router-dom v7 (só `exports`); `virtual`
// dispensa a resolução, como no teste das Estatísticas.
jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...p }: any) => (
      <a href={to} {...p}>
        {children}
      </a>
    ),
  }),
  { virtual: true },
);
const mockHasPermission = jest.fn(() => true);
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({ hasPermission: mockHasPermission }),
}));
import toast from "react-hot-toast";

const CONCLUIDO = {
  courseId: 24,
  titulo: "Programação FullStack",
  thumbnailUrl: "https://res.cloudinary.com/x/image/upload/v1/capa.png",
  empresaSlug: "v-corp",
  empresaNome: "V-CORP",
  totalAulas: 3,
  aulasConcluidas: 3,
  ultimaAula: "2026-10-22",
  quiz: { nota: 100, aprovado: true },
};
const SEM_CAPA = {
  ...CONCLUIDO,
  courseId: 25,
  titulo: "Excel Avançado",
  thumbnailUrl: null,
  quiz: null,
  ultimaAula: "2026-09-01",
};
const ANDAMENTO = {
  ...CONCLUIDO,
  courseId: 30,
  titulo: "LGPD na Prática",
  totalAulas: 5,
  aulasConcluidas: 2,
  quiz: null,
};

const responder = (data: any) => (api.get as jest.Mock).mockResolvedValue({ data });

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission.mockReturnValue(true);
  (global as any).URL.createObjectURL = jest.fn(() => "blob:certificado");
  (global as any).URL.revokeObjectURL = jest.fn();
});

describe("Cursos do Painel (Perfil)", () => {
  it("busca sempre os certificados do próprio usuário", async () => {
    responder({ concluidos: [], emAndamento: [] });
    render(<CertificadosCursos />);
    await screen.findByText(/o certificado\s+aparece aqui/);
    expect(api.get).toHaveBeenCalledWith("/api/certificates/mine");
  });

  it("sem cursos: explica e leva ao catálogo (só com acesso a cursos)", async () => {
    responder({ concluidos: [], emAndamento: [] });
    const { unmount } = render(<CertificadosCursos />);
    const link = await screen.findByText("Ver cursos");
    expect(link.closest("a")!.getAttribute("href")).toBe("/content/courses");
    unmount();

    mockHasPermission.mockReturnValue(false);
    render(<CertificadosCursos />);
    await screen.findByText(/o certificado\s+aparece aqui/);
    expect(screen.queryByText("Ver cursos")).toBeNull();
  });

  it("concluídos: capa do curso (ou a padrão), data de conclusão e nota do quiz", async () => {
    responder({ concluidos: [CONCLUIDO, SEM_CAPA], emAndamento: [] });
    render(<CertificadosCursos />);
    await screen.findByText("Programação FullStack");

    const capas = document.querySelectorAll(".course-cert-thumb img") as NodeListOf<HTMLImageElement>;
    expect(capas[0].src).toBe(CONCLUIDO.thumbnailUrl);
    expect(capas[1].src).toContain("curso-padrao");
    expect(screen.getByText("Concluído em 22/10/2026 · quiz: nota 100")).toBeTruthy();
    expect(screen.getByText("Concluído em 01/09/2026")).toBeTruthy();
    expect(screen.getAllByText("Concluído")).toHaveLength(2);
  });

  it("em andamento: progresso, aulas que faltam e link para continuar", async () => {
    responder({ concluidos: [], emAndamento: [ANDAMENTO] });
    render(<CertificadosCursos />);
    await screen.findByText("LGPD na Prática");

    expect(screen.getByText("2 de 5 aulas · 40% · faltam 3 aulas")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("Continuar").closest("a")!.getAttribute("href")).toBe(
      "/content/courses/30",
    );
    expect(screen.getByText(/Nenhum curso concluído ainda/)).toBeTruthy();
  });

  it("baixar: gera o PDF do curso e salva com nome sem acentos", async () => {
    responder({ concluidos: [CONCLUIDO], emAndamento: [] });
    render(<CertificadosCursos />);
    await screen.findByText("Programação FullStack");

    (api.get as jest.Mock).mockResolvedValueOnce({ data: "pdf" });
    const cliques: string[] = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      cliques.push(this.download);
    };
    try {
      fireEvent.click(screen.getByLabelText("Baixar o certificado de Programação FullStack"));
      await waitFor(() => expect(cliques).toEqual(["certificado-programacao-fullstack.pdf"]));
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }
    expect(api.get).toHaveBeenLastCalledWith("/api/admin/courses/24/certificate", {
      responseType: "blob",
    });
  });

  it("ver: abre o PDF numa aba nova; se falhar, fecha a aba e avisa", async () => {
    responder({ concluidos: [CONCLUIDO], emAndamento: [] });
    render(<CertificadosCursos />);
    await screen.findByText("Programação FullStack");

    const aba = { location: { href: "" }, close: jest.fn() };
    const open = jest.spyOn(window, "open").mockReturnValue(aba as any);

    (api.get as jest.Mock).mockResolvedValueOnce({ data: "pdf" });
    fireEvent.click(screen.getByLabelText("Abrir o certificado de Programação FullStack"));
    await waitFor(() => expect(aba.location.href).toBe("blob:certificado"));

    (api.get as jest.Mock).mockRejectedValueOnce(new Error("403"));
    fireEvent.click(screen.getByLabelText("Ver o certificado de Programação FullStack"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(aba.close).toHaveBeenCalled();
    open.mockRestore();
  });
});
