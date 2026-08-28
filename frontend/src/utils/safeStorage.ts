// Acesso a localStorage tolerante a falhas: em modo privado, storage bloqueado
// ou cota estourada, os métodos nativos lançam. Envolvendo em try/catch,
// evitamos quebrar o boot da aplicação (ex.: leitura do token/tema).
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage indisponível — ignora */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage indisponível — ignora */
    }
  },
};
