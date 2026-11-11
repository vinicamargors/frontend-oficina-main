import { Edit2, History, MessageCircle, Wrench } from 'lucide-react';
import type { Veiculo } from '../../types';
import { Button, PlateChip, formatarPlaca } from '../../components/ui';
import { MenuAcoes } from './MenuAcoes';
import { montarLinkWhatsApp } from './auxiliares';

/** Visão por placas: um veículo por linha, com o dono; abrir OS é a ação única, o resto fica no menu. */
export function LinhaVeiculo({
  veiculo,
  nomeDono,
  telDono,
  qtdOS,
  aoHistorico,
  aoEditar,
  aoAbrirOS,
}: {
  veiculo: Veiculo;
  nomeDono: string;
  telDono: string;
  qtdOS: number;
  aoHistorico: () => void;
  aoEditar: () => void;
  aoAbrirOS: () => void;
}) {
  const zapUrl = montarLinkWhatsApp(telDono, nomeDono, veiculo.placa);
  const meta = [nomeDono, telDono, veiculo.km_atual != null ? `${Number(veiculo.km_atual).toLocaleString('pt-BR')} km` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex min-h-16 items-center gap-1 py-2.5 pl-4 pr-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <PlateChip placa={veiculo.placa} />
          <span className="min-w-0 truncate text-sm font-medium text-ink">{veiculo.modelo}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{meta}</p>
      </div>
      {zapUrl && (
        <a
          href={zapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp de ${nomeDono}`}
          title="Chamar no WhatsApp"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
        </a>
      )}
      <Button
        variante="secundario"
        tamanho="sm"
        icone={Wrench}
        onClick={aoAbrirOS}
        aria-label={`Abrir OS para ${formatarPlaca(veiculo.placa)}`}
        title="Abrir ordem de serviço"
        className="w-11 shrink-0 !px-0 lg:w-auto lg:!px-3"
      >
        <span className="hidden lg:inline">Abrir OS</span>
      </Button>
      <MenuAcoes
        rotulo={`Mais ações do veículo ${formatarPlaca(veiculo.placa)}`}
        itens={[
          { rotulo: `Histórico (${qtdOS})`, icone: History, aoClicar: aoHistorico },
          { rotulo: 'Editar veículo', icone: Edit2, aoClicar: aoEditar },
        ]}
      />
    </li>
  );
}
