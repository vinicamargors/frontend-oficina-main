import { Edit2, History, Wrench } from 'lucide-react';
import { Button } from '../../components/ui';

const ICONE = 'flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg px-1 text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

/** Ações de um veículo dentro do cliente: histórico (com a contagem), editar e a ação única "abrir OS". */
export function AcoesVeiculo({
  placa,
  qtdOS,
  aoHistorico,
  aoEditar,
  aoAbrirOS,
}: {
  placa: string;
  qtdOS: number;
  aoHistorico: () => void;
  aoEditar: () => void;
  aoAbrirOS: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" onClick={aoHistorico} aria-label={`Histórico do veículo ${placa}`} title={`Histórico (${qtdOS} OS)`} className={ICONE}>
        <History size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs font-medium tabular-nums">{qtdOS}</span>
      </button>
      <button type="button" onClick={aoEditar} aria-label={`Editar veículo ${placa}`} title="Editar dados do veículo" className={ICONE}>
        <Edit2 size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <Button
        variante="secundario"
        tamanho="sm"
        icone={Wrench}
        onClick={aoAbrirOS}
        aria-label={`Abrir OS para ${placa}`}
        title="Abrir ordem de serviço"
        className="ml-1 w-11 !px-0 lg:w-auto lg:!px-3"
      >
        <span className="hidden lg:inline">Abrir OS</span>
      </Button>
    </div>
  );
}
