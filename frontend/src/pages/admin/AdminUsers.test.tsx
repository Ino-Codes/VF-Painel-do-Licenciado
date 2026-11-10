import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminUsers from "./AdminUsers.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../components/layout/Menu.tsx", () => () => null);
jest.mock("../../components/layout/Footer.tsx", () => () => null);
jest.mock("../../components/forms/UserFormModal.tsx", () => () => null);

let mockPermissoes: string[] = ["users.view", "users.manage"];
jest.mock("../../context/AuthContext.tsx", () => ({
  useAuth: () => ({
    user: { id: 99, nome: "Admin", email: "adm@x.com", permissions: mockPermissoes },
    loading: false,
  }),
}));

const respostasGet = (pendentes: number) =>
  (api.get as jest.Mock).mockImplementation((url: string) =>
    url === "/api/users/admin/convites/pendentes"
      ? Promise.resolve({ data: { total: pendentes, totalPendentes: pendentes } })
      : Promise.resolve({
          data: {
            users: [{ id: 1, nome: "Ana", email: "ana@x.com", role: "licenciado", convite_pendente: true }],
            totalPages: 1,
          },
        }),
  );

describe("AdminUsers — convites pendentes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissoes = ["users.view", "users.manage"];
  });

  it("reenvia em massa depois de confirmar", async () => {
    respostasGet(65);
    (api.post as jest.Mock).mockResolvedValue({ data: { enviados: 65, falhas: [] } });
    render(<AdminUsers />);

    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convites pendentes (65)" }));
    expect(screen.getByText(/A senha atual dessas contas deixa de valer/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar convites" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/users/admin/convites/reenviar-pendentes", {
        internal: "false",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("65 convite(s) reenviado(s).");
  });

  it("reenvia o convite de uma conta pela lista", async () => {
    respostasGet(1);
    (api.post as jest.Mock).mockResolvedValue({ data: { message: "Convite reenviado para ana@x.com." } });
    render(<AdminUsers />);
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar convite para Ana" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/users/admin/1/convite"));
  });

  it("sem users.manage não consulta nem oferece os convites", async () => {
    mockPermissoes = ["users.view"];
    respostasGet(65);
    render(<AdminUsers />);
    await screen.findByText("Ana");
    expect(api.get).not.toHaveBeenCalledWith("/api/users/admin/convites/pendentes", expect.anything());
    expect(screen.queryByRole("button", { name: /Reenviar convite/ })).toBeNull();
  });
});
