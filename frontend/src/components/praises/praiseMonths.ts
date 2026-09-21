// Competência mensal dos elogios. O mês trafega sempre como "YYYY-MM".
//
// Os rótulos são montados a partir do texto, não de um Date: "2026-09-01"
// vira meia-noite UTC e, no fuso de São Paulo, volta para 31/08 — o mês
// apareceria errado.

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const partes = (mes?: string | null): [string, number] | null => {
  if (!mes) return null;
  const [ano, m] = String(mes).split("-");
  const indice = Number(m) - 1;
  if (!ano || Number.isNaN(indice) || indice < 0 || indice > 11) return null;
  return [ano, indice];
};

/** "2026-09" → "setembro de 2026" */
export const mesLongo = (mes?: string | null): string => {
  const p = partes(mes);
  return p ? `${MESES[p[1]]} de ${p[0]}` : "Sem mês definido";
};

/** "2026-09" → "Setembro de 2026" (para títulos) */
export const mesTitulo = (mes?: string | null): string => {
  const texto = mesLongo(mes);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** "2026-09" → "set/2026" (para as fichas do seletor) */
export const mesCurto = (mes?: string | null): string => {
  const p = partes(mes);
  return p ? `${MESES_CURTOS[p[1]]}/${p[0]}` : "—";
};

/** Mês corrente no relógio do usuário, em "YYYY-MM". */
export const mesAtual = (): string => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

export interface ComMes {
  reference_month?: string | null;
}

/**
 * Agrupa por competência preservando a ordem em que os itens chegaram — as
 * listas já vêm ordenadas por mês pelo backend, então reordenar aqui só
 * criaria uma segunda fonte de verdade.
 */
export const agruparPorMes = <T extends ComMes>(
  itens: T[],
): { mes: string | null; itens: T[] }[] => {
  const grupos: { mes: string | null; itens: T[] }[] = [];
  itens.forEach((item) => {
    const mes = item.reference_month || null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.itens.push(item);
    else grupos.push({ mes, itens: [item] });
  });
  return grupos;
};
