import type { ElementType, ReactNode } from 'react';

export function Panel({ as: Tag = 'div', className = '', children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={`bg-surface rounded-lg shadow-card dark:shadow-none ${className}`}>{children}</Tag>;
}
