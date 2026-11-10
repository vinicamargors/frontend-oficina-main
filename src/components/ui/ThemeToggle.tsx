import { Moon, Sun } from 'lucide-react';
import { useTema } from '../../theme/TemaContext';

export function ThemeToggle() {
  const { tema, definir } = useTema();
  const escuro = tema === 'escuro';
  return (
    <button
      type="button"
      onClick={() => definir(escuro ? 'claro' : 'escuro')}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="inline-flex h-10 min-h-11 md:min-h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {escuro ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
