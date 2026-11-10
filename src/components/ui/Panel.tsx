import type { ElementType, ReactNode } from 'react';

const ESPACOS = { nenhum: '', md: 'p-5', lg: 'p-6' } as const;

// Card estilo "sem contorno": separação por preenchimento (surface sobre canvas), sem borda nem sombra.
// No escuro, o degrau surface/canvas já faz a separação.
// Padding padrão p-5: quem já aplica o próprio padding via className deve passar espaco="nenhum".
export function Panel({
  as: Tag = 'div',
  espaco = 'md',
  className = '',
  children,
}: {
  as?: ElementType;
  /** md = p-5 (padrão), lg = p-6, nenhum = sem padding (use quando o className já define padding). */
  espaco?: keyof typeof ESPACOS;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`bg-surface rounded-2xl ${ESPACOS[espaco]} ${className}`}>{children}</Tag>;
}
