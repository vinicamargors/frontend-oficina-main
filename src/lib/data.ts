const dois = (n: number) => String(n).padStart(2, '0');

/**
 * Data no calendário LOCAL como `AAAA-MM-DD`. Nunca usa UTC: `toISOString()` em São Paulo
 * depois das 21h já devolve o dia seguinte.
 */
export function dataLocalISO(d: Date): string {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** "Hoje" no calendário local, como `AAAA-MM-DD`. */
export const hojeLocalISO = (): string => dataLocalISO(new Date());
