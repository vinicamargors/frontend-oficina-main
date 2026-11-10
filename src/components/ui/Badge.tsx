import type { ReactNode } from 'react';

type Tom = 'neutro' | 'marca' | 'perigo' | 'sucesso' | 'alerta' | 'info';

const TONS: Record<Tom, string> = {
  neutro: 'bg-muted text-ink-muted',
  marca: 'bg-brand/15 text-brand-ink',
  perigo: 'bg-danger/15 text-danger',
  sucesso: 'bg-success/15 text-success',
  alerta: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
};

export function Badge({ tom = 'neutro', className = '', children }: { tom?: Tom; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[tom]} ${className}`}>{children}</span>;
}
