// Mesma regra do backend (backend/authSession.js → validarSenha). O backend
// é quem decide; aqui é só para avisar antes de enviar.

export const SENHA_MIN = 8;
export const SENHA_MAX = 64;

export const REGRA_SENHA = `Mínimo de ${SENHA_MIN} caracteres, com letras e números.`;

/** Mensagem de erro, ou null se a senha é aceitável. */
export const validarSenha = (senha: string, email?: string): string | null => {
  if (senha.length < SENHA_MIN) {
    return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (senha.length > SENHA_MAX) {
    return `A senha deve ter no máximo ${SENHA_MAX} caracteres.`;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
    return "A senha deve ter letras e números.";
  }
  const usuario = (email || "").trim().toLowerCase().split("@")[0];
  if (usuario && usuario.length >= 4 && senha.toLowerCase().includes(usuario)) {
    return "A senha não pode conter o seu e-mail.";
  }
  return null;
};
