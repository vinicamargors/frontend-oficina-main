import { CircleAlert, TriangleAlert } from 'lucide-react';

/** Pílula "Atenção"/"Atrasado" para OS paradas em Orçamento ou Aguardando peça (texto, não só cor). */
export function MarcaAtraso({ nivel }: { nivel: 'atencao' | 'atrasado' }) {
  const atrasado = nivel === 'atrasado';
  const Icone = atrasado ? CircleAlert : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        atrasado ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
      }`}
    >
      <Icone size={12} aria-hidden="true" />
      {atrasado ? 'Atrasado' : 'Atenção'}
    </span>
  );
}
