export type TourMeta = { tours: Record<string, number>; tours_pular_todos?: boolean };

function normalizar(x: unknown): TourMeta {
  const out: TourMeta = { tours: {} };
  if (!x || typeof x !== 'object') return out;
  const o = x as { tours?: unknown; tours_pular_todos?: unknown };
  if (o.tours && typeof o.tours === 'object' && !Array.isArray(o.tours)) {
    for (const [k, v] of Object.entries(o.tours as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out.tours[k] = v;
    }
  }
  if (o.tours_pular_todos === true) out.tours_pular_todos = true;
  return out;
}

/** Une a conta (`user_metadata`) com o espelho local: maior versão vence; "pular todos" = OU. */
export function lerEstado(userMeta: unknown, espelho: TourMeta | null): TourMeta {
  const a = normalizar(userMeta);
  const b = normalizar(espelho);
  const tours = { ...a.tours };
  for (const [k, v] of Object.entries(b.tours)) tours[k] = Math.max(tours[k] ?? 0, v);
  const r: TourMeta = { tours };
  if (a.tours_pular_todos || b.tours_pular_todos) r.tours_pular_todos = true;
  return r;
}

export function jaViu(m: TourMeta, id: string, versao: number): boolean {
  return (m.tours[id] ?? 0) >= versao;
}

export function comVisto(m: TourMeta, id: string, versao: number): TourMeta {
  return { ...m, tours: { ...m.tours, [id]: Math.max(m.tours[id] ?? 0, versao) } };
}

export function comPularTodos(m: TourMeta): TourMeta {
  return { ...m, tours: { ...m.tours }, tours_pular_todos: true };
}

const chave = (userId: string) => `mecanify_tours_${userId}`;

export function carregarEspelho(userId: string): TourMeta | null {
  try {
    const bruto = localStorage.getItem(chave(userId));
    return bruto ? normalizar(JSON.parse(bruto)) : null;
  } catch {
    return null;
  }
}

export function salvarEspelho(userId: string, m: TourMeta): void {
  try {
    localStorage.setItem(chave(userId), JSON.stringify(m));
  } catch {
    /* sem armazenamento: segue só com a conta */
  }
}
