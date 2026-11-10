import { useEffect, type ReactNode } from 'react';

export function PageHeader({ titulo, acoes }: { titulo: string; acoes?: ReactNode }) {
  useEffect(() => {
    document.title = `${titulo} · Mecanify`;
  }, [titulo]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 className="text-[1.375rem] font-semibold text-ink">{titulo}</h1>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}
