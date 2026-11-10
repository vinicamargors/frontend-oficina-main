// Única exceção de cor fixa da interface: a placa é idêntica nos dois temas.
export function formatarPlaca(placa: string): string {
  const p = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function PlateChip({ placa }: { placa: string }) {
  return (
    <span
      className="inline-flex flex-col overflow-hidden rounded-[4px] border border-[#1D4ED8]/30 bg-[#FFFFFF] align-middle"
      role="img"
      aria-label={`Placa ${formatarPlaca(placa)}`}
    >
      <span className="h-1 bg-[#1D4ED8]" aria-hidden="true" />
      <span className="px-2 py-0.5 font-mono text-sm font-semibold uppercase leading-tight tracking-wider text-[#111111]">{formatarPlaca(placa)}</span>
    </span>
  );
}
