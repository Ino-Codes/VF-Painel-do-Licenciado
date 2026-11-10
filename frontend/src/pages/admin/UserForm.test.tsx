import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserForm from "./UserForm.tsx";
import TabContent from "./TabContent.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";

jest.mock("../../api.ts", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));
// Componentes pesados que não importam para o convite.
jest.mock("./CorporatePhotoUploader.tsx", () => () => null);
jest.mock("../../components/forms/DatePicker.tsx", () => () => null);

describe("UserForm — convite em vez de senha inicial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it("criação não pede senha e avisa do convite", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { success: true, convite_enviado: true } });
    const onSuccess = jest.fn();
    const { container } = render(
      <UserForm userToEdit={null} formType="licenciado" onSuccess={onSuccess} onCancel={jest.fn()} />,
    );

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText("Senha inicial")).toBeNull();
    expect(screen.getByText(/receberá por e-mail um convite/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Souza" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Usuário" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, corpo] = (api.post as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/users/admin");
    expect(corpo).not.toHaveProperty("password");
    expect(toast.success).toHaveBeenCalledWith("Usuário criado! Convite enviado para ana@x.com.");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("avisa quando a conta foi criada mas o e-mail falhou", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { success: true, convite_enviado: false } });
    render(<UserForm userToEdit={null} formType="licenciado" onSuccess={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar Usuário" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((toast.error as jest.Mock).mock.calls[0][0]).toMatch(/Reenviar convite/);
  });

  it("edição de quem não criou a senha permite reenviar o convite", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { message: "Convite reenviado para ana@x.com." } });
    render(
      <UserForm
        userToEdit={{ id: 7, nome: "Ana", email: "ana@x.com", convite_pendente: true }}
        formType="licenciado"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reenviar convite" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/users/admin/7/convite"));
    expect(toast.success).toHaveBeenCalledWith("Convite reenviado para ana@x.com.");
  });

  it("edição de quem já criou a senha não mostra o reenvio", () => {
    render(
      <UserForm
        userToEdit={{ id: 8, nome: "Bia", email: "bia@x.com", convite_pendente: false }}
        formType="licenciado"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Reenviar convite" })).toBeNull();
  });
});

describe("TabContent — convite pendente na lista", () => {
  const props = (handleReenviarConvite?: jest.Mock) => ({
    tab: "licenciados" as const,
    state: {
      users: [
        { id: 1, nome: "Ana", email: "ana@x.com", role: "licenciado", convite_pendente: true },
        { id: 2, nome: "Bia", email: "bia@x.com", role: "licenciado", convite_pendente: false },
      ],
      totalPages: 1,
      currentPage: 1,
      sortConfig: { key: "nome", order: "ASC" },
    } as any,
    currentUser: { id: 99 } as any,
    onAddClick: jest.fn(),
    handleSearch: jest.fn(),
    setEditingUser: jest.fn(),
    handleDeleteClick: jest.fn(),
    handlePageChange: jest.fn(),
    fetchUsers: jest.fn(),
    handleSort: jest.fn(),
    handleReenviarConvite,
  });

  it("marca e oferece o reenvio só para quem tem convite pendente", () => {
    const reenviar = jest.fn();
    render(<TabContent {...props(reenviar)} />);
    expect(screen.getAllByText("Convite pendente")).toHaveLength(1);
    const botoes = screen.getAllByRole("button", { name: /Reenviar convite/ });
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]);
    expect(reenviar).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("sem permissão (sem handler) não mostra o botão", () => {
    render(<TabContent {...props(undefined)} />);
    expect(screen.queryByRole("button", { name: /Reenviar convite/ })).toBeNull();
  });
});
