import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import CertificadosExternos from "./CertificadosExternos.tsx";
import api from "../../api.ts";

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));
// O MonthPicker tem testes próprios; aqui basta um campo que devolva "AAAA-MM".
jest.mock("../forms/MonthPicker.tsx", () => (p: any) => (
  <input id={p.inputId} aria-label="mes" value={p.value} onChange={(e) => p.onChange(e.target.value)} />
));
import toast from "react-hot-toast";

const CERT = {
  id: 7,
  nome: "Professional Scrum Master I",
  organizacao: "Scrum.org",
  mes: "2025-03",
  arquivos: [
    { id: 1, nome: "frente.png", tipo: "imagem", tamanho: 200000, url: "https://res.cloudinary.com/x/image/upload/v1/certificados/a.png" },
    { id: 2, nome: "verso.pdf", tipo: "pdf", tamanho: 3 * 1024 * 1024, url: null },
  ],
};
const SO_PDF = { ...CERT, id: 8, nome: "Diploma", mes: "2020-12", arquivos: [CERT.arquivos[1]] };

const arquivo = (nome: string, tipo: string, bytes = 1000) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

const preencher = (nome = "AWS Cloud Practitioner", org = "Amazon", mes = "2024-05") => {
  fireEvent.change(screen.getByLabelText("Nome do certificado ou diploma"), { target: { value: nome } });
  fireEvent.change(screen.getByLabelText("Organização emissora"), { target: { value: org } });
  fireEvent.change(screen.getByLabelText("mes"), { target: { value: mes } });
};
const anexar = (...files: File[]) =>
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files } });

beforeEach(() => jest.clearAllMocks());

describe("Certificados e diplomas (Perfil)", () => {
  it("lista vazia mostra a explicação e o botão de adicionar", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<CertificadosExternos />);
    expect(await screen.findByText("Adicionar certificado")).toBeTruthy();
  });

  it("cards: miniatura otimizada da imagem, PDF sem imagem e data curta", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [CERT, SO_PDF] });
    render(<CertificadosExternos />);
    await screen.findByText("Professional Scrum Master I");
    const img = document.querySelector(".ext-cert-thumb img") as HTMLImageElement;
    expect(img.src).toContain("/image/upload/c_fill,g_auto,w_640,h_400,q_auto,f_auto/");
    expect(screen.getByText("2 arquivos")).toBeTruthy();
    expect(screen.getByText("Emitido em mar/2025")).toBeTruthy();
    // Certificado só com PDF: capa genérica de PDF.
    const cards = document.querySelectorAll(".ext-cert-card");
    expect(cards[1].querySelector(".ext-cert-thumb-pdf")).not.toBeNull();
  });

  it("não envia sem arquivo", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByText("Adicionar certificado"));
    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Adicione ao menos uma imagem ou PDF do certificado.");
  });

  it("recusa tipo não aceito e imagem acima de 10 MB, já na escolha", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByText("Adicionar certificado"));
    anexar(arquivo("planilha.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
    anexar(arquivo("foto.png", "image/png", 11 * 1024 * 1024));
    expect(document.querySelectorAll(".ext-cert-file").length).toBe(0);
    expect((toast.error as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      '"planilha.xlsx" não é aceito. Envie imagens (JPG, PNG, WEBP) ou PDF.',
      '"foto.png" tem 11,0 MB; o limite para imagens é 10,0 MB.',
    ]);
  });

  it("limita a 5 arquivos", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByText("Adicionar certificado"));
    anexar(...Array.from({ length: 6 }, (_, i) => arquivo(`${i}.pdf`, "application/pdf")));
    expect(document.querySelectorAll(".ext-cert-file").length).toBe(5);
  });

  it("não aceita mês futuro", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByText("Adicionar certificado"));
    preencher("X", "Y", "2999-01");
    anexar(arquivo("a.pdf", "application/pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("A data de emissão não pode ser futura.");
  });

  it("cadastra enviando campos e arquivos, e o card aparece na lista", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    const novo = { ...SO_PDF, id: 9, nome: "AWS Cloud Practitioner", organizacao: "Amazon", mes: "2024-05" };
    (api.post as jest.Mock).mockResolvedValue({ data: novo });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByText("Adicionar certificado"));
    preencher();
    anexar(arquivo("cert.pdf", "application/pdf"), arquivo("foto.jpg", "image/jpeg"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, fd] = (api.post as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/user-certificates");
    expect(fd.get("nome")).toBe("AWS Cloud Practitioner");
    expect(fd.get("organizacao")).toBe("Amazon");
    expect(fd.get("mes")).toBe("2024-05");
    expect(fd.getAll("arquivos").map((f: File) => f.name)).toEqual(["cert.pdf", "foto.jpg"]);
    expect(await screen.findByText("AWS Cloud Practitioner")).toBeTruthy();
  });

  it("edição: remover um arquivo existente vai em 'remover'", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [CERT] });
    (api.put as jest.Mock).mockResolvedValue({ data: { ...CERT, arquivos: [CERT.arquivos[1]] } });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByLabelText("Editar Professional Scrum Master I"));
    fireEvent.click(screen.getByLabelText("Remover frente.png"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, fd] = (api.put as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/user-certificates/7");
    expect(JSON.parse(fd.get("remover"))).toEqual([1]);
    expect(fd.getAll("arquivos").length).toBe(0);
  });

  it("visualização mostra a imagem e o PDF com botão de abrir", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [CERT] });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByLabelText("Ver Professional Scrum Master I"));
    const viewer = document.querySelector(".ext-cert-viewer") as HTMLElement;
    expect(within(viewer).getByText("Scrum.org · emitido em março de 2025")).toBeTruthy();
    expect((viewer.querySelector(".ext-cert-viewer-img img") as HTMLImageElement).src).toBe(CERT.arquivos[0].url);
    expect(within(viewer).getByText("verso.pdf")).toBeTruthy();
    expect(within(viewer).getByText("Abrir PDF")).toBeTruthy();
  });

  it("excluir pede confirmação e remove o card", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [CERT] });
    (api.delete as jest.Mock).mockResolvedValue({ data: { success: true } });
    render(<CertificadosExternos />);
    fireEvent.click(await screen.findByLabelText("Excluir Professional Scrum Master I"));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/api/user-certificates/7"));
    await waitFor(() => expect(screen.queryByText("Professional Scrum Master I")).toBeNull());
  });
});
