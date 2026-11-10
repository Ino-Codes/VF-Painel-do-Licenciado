import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetPassword from "./ResetPassword.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";

// O Jest do CRA não resolve o react-router-dom v7 (só `exports`): simulamos
// só o que a tela usa.
let mockParams = new URLSearchParams();
const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => ({
    useSearchParams: () => [mockParams],
    useNavigate: () => mockNavigate,
    Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
  }),
  { virtual: true },
);
jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const preencher = (senha: string) => {
  fireEvent.change(screen.getByPlaceholderText("Nova Senha"), { target: { value: senha } });
  fireEvent.change(screen.getByPlaceholderText("Confirmar Nova Senha"), {
    target: { value: senha },
  });
};

describe("ResetPassword — convite de 1º acesso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("com convite=1 mostra “Criar sua senha” e envia o token", async () => {
    mockParams = new URLSearchParams("token=abc123&convite=1");
    (api.post as jest.Mock).mockResolvedValue({ data: { message: "ok" } });
    render(<ResetPassword />);

    expect(screen.getByRole("heading", { name: "Criar sua senha" })).toBeTruthy();
    expect(screen.getByText(/Bem-vindo ao Painel V-CORP/)).toBeTruthy();

    preencher("Segura2026x");
    fireEvent.click(screen.getByRole("button", { name: "Criar Senha" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/auth/redefinir-senha", {
        token: "abc123",
        password: "Segura2026x",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Senha criada! Entre com o seu e-mail e a nova senha.",
    );
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("link de convite vencido orienta a pedir o reenvio", async () => {
    mockParams = new URLSearchParams("token=velho&convite=1");
    (api.post as jest.Mock).mockRejectedValue({
      response: {
        data: {
          error: "Token inválido ou expirado. Por favor, solicite a redefinição novamente.",
        },
      },
    });
    render(<ResetPassword />);
    preencher("Segura2026x");
    fireEvent.click(screen.getByRole("button", { name: "Criar Senha" }));

    expect(await screen.findByText(/Peça ao administrador para reenviar o convite/)).toBeTruthy();
  });

  it("sem convite continua sendo a redefinição de senha", () => {
    mockParams = new URLSearchParams("token=abc123");
    render(<ResetPassword />);
    expect(screen.getByRole("heading", { name: "Criar Nova Senha" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Redefinir Senha" })).toBeTruthy();
    expect(screen.queryByText(/Bem-vindo ao Painel V-CORP/)).toBeNull();
  });
});
