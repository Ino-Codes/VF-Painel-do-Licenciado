import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute.tsx";
import api from "../../api.ts";
import { validarSenha } from "../../utils/senha.ts";

// O Jest do CRA não resolve o react-router-dom v7 (só `exports`): o guard
// só usa <Navigate>, simulado aqui.
jest.mock(
  "react-router-dom",
  () => ({ Navigate: ({ to }: { to: string }) => <p>redireciona para {to}</p> }),
  { virtual: true },
);
jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { put: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockUsuario: any = null;
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({
    user: mockUsuario,
    loading: false,
    login: mockLogin,
    logout: mockLogout,
    hasPermission: () => true,
    hasAnyPermission: () => true,
  }),
}));

const renderiza = () =>
  render(
    <ProtectedRoute>
      <p>Conteúdo protegido</p>
    </ProtectedRoute>,
  );

describe("ProtectedRoute — troca de senha do 1º acesso", () => {
  beforeEach(() => jest.clearAllMocks());

  it("com a troca pendente, mostra o modal em vez da tela", () => {
    mockUsuario = { id: 1, email: "ana.souza@x.com", must_change_password: true };
    renderiza();
    expect(screen.getByRole("dialog", { name: "Definir Nova Senha" })).toBeTruthy();
    expect(screen.queryByText("Conteúdo protegido")).toBeNull();
  });

  it("sem pendência, mostra a tela", () => {
    mockUsuario = { id: 1, email: "ana.souza@x.com", must_change_password: false };
    renderiza();
    expect(screen.getByText("Conteúdo protegido")).toBeTruthy();
  });

  it("senha fraca não chega ao backend; senha boa grava a sessão nova", async () => {
    mockUsuario = { id: 1, email: "ana.souza@x.com", must_change_password: true };
    (api.put as jest.Mock).mockResolvedValue({
      data: { user: { id: 1, must_change_password: false }, token: "novo" },
    });
    renderiza();
    const nova = screen.getByLabelText("Nova senha");
    const conf = screen.getByLabelText("Confirmar nova senha");

    fireEvent.change(nova, { target: { value: "curta1" } });
    fireEvent.change(conf, { target: { value: "curta1" } });
    fireEvent.click(screen.getByText("Salvar Nova Senha"));
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.change(nova, { target: { value: "Segura2026" } });
    fireEvent.change(conf, { target: { value: "Segura2026" } });
    fireEvent.click(screen.getByText("Salvar Nova Senha"));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ id: 1, must_change_password: false }, "novo"));
    expect(api.put).toHaveBeenCalledWith("/api/users/force-change-password", { password: "Segura2026" });
  });

  it("Sair encerra a sessão", () => {
    mockUsuario = { id: 1, email: "ana.souza@x.com", must_change_password: true };
    renderiza();
    fireEvent.click(screen.getByText("Sair"));
    expect(mockLogout).toHaveBeenCalled();
  });
});

describe("validarSenha (mesma regra do backend)", () => {
  it.each([
    ["curta1", "pelo menos 8"],
    ["somenteletras", "letras e números"],
    ["12345678", "letras e números"],
    ["ana.souza2026", "e-mail"],
  ])("%s → erro", (senha, trecho) => {
    expect(validarSenha(senha, "ana.souza@x.com")).toContain(trecho);
  });
  it("aceita senha com letras e números", () => {
    expect(validarSenha("Segura2026", "ana.souza@x.com")).toBeNull();
  });
});
