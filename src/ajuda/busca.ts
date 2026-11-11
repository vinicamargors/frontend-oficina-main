import type { Cargo, GuiaDef } from './tipos';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Guias do cargo cujo título, resumo ou palavras-chave contêm o termo (sem acento, sem caixa). */
export function filtrarGuias(guias: GuiaDef[], termo: string, cargo: Cargo): GuiaDef[] {
  const t = normalizar(termo);
  return guias
    .filter((g) => g.cargos.includes(cargo))
    .filter((g) => !t || normalizar([g.titulo, g.resumo, ...g.palavrasChave].join(' ')).includes(t));
}
