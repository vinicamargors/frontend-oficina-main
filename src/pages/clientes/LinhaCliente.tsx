import { ChevronDown, ClipboardList, Edit2, MessageCircle, Plus } from 'lucide-react';
import type { Cliente, UltimaOS, Veiculo } from '../../types';
import { Badge, Button, PlateChip, formatarPlaca } from '../../components/ui';
import { AcoesVeiculo } from './AcoesVeiculo';
import { MenuAcoes } from './MenuAcoes';
import { montarLinkWhatsApp } from './auxiliares';

/**
 * Cliente como linha expansível: tocar na linha mostra os veículos (separados por divisor). À direita,
 * só o WhatsApp e o menu "mais ações" (editar ficha, adicionar veículo, histórico).
 */
export function LinhaCliente({
  cliente,
  carros,
  osPorVeiculo,
  totalOS,
  expandido,
  aoAlternar,
  aoEditar,
  aoAdicionarVeiculo,
  aoHistorico,
  aoHistoricoVeiculo,
  aoEditarVeiculo,
  aoAbrirOS,
}: {
  cliente: Cliente;
  carros: Veiculo[];
  osPorVeiculo: Record<string, UltimaOS[]>;
  totalOS: number;
  expandido: boolean;
  aoAlternar: () => void;
  aoEditar: () => void;
  aoAdicionarVeiculo: () => void;
  aoHistorico: () => void;
  aoHistoricoVeiculo: (v: Veiculo) => void;
  aoEditarVeiculo: (v: Veiculo) => void;
  aoAbrirOS: (v: Veiculo) => void;
}) {
  const zapUrl = montarLinkWhatsApp(cliente.telefone, cliente.nome);
  const idDetalhe = `cliente-${cliente.id}-detalhe`;
  const qtd = `${carros.length} ${carros.length === 1 ? 'veículo' : 'veículos'}`;
  const detalhes = [cliente.cpf_cnpj, cliente.endereco].filter(Boolean).join(' · ');

  return (
    <li>
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={expandido}
          aria-controls={idDetalhe}
          className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg py-2.5 pl-4 pr-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        >
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-ink-subtle transition-transform motion-reduce:transition-none ${expandido ? 'rotate-180' : ''}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{cliente.nome}</span>
            <span className="mt-0.5 block truncate text-xs tabular-nums text-ink-muted">
              {cliente.telefone || 'Sem fone'} · {qtd}
            </span>
            {carros.length > 0 && (
              <span className="mt-0.5 block truncate font-mono text-xs tracking-wide text-ink-muted lg:hidden">
                {carros.map((v) => formatarPlaca(v.placa)).join(' · ')}
              </span>
            )}
          </span>
          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            {carros.slice(0, 2).map((v) => (
              <PlateChip key={v.id} placa={v.placa} />
            ))}
            {carros.length > 2 && <Badge>+{carros.length - 2}</Badge>}
          </span>
        </button>

        {zapUrl && (
          <a
            href={zapUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp de ${cliente.nome}`}
            title="Chamar no WhatsApp"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <MessageCircle size={20} strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
        <MenuAcoes
          rotulo={`Mais ações de ${cliente.nome}`}
          itens={[
            { rotulo: 'Editar ficha', icone: Edit2, aoClicar: aoEditar },
            { rotulo: 'Adicionar veículo', icone: Plus, aoClicar: aoAdicionarVeiculo },
            { rotulo: `Histórico de OS (${totalOS})`, icone: ClipboardList, aoClicar: aoHistorico },
          ]}
        />
      </div>

      {expandido && (
        <div id={idDetalhe} className="pb-3 pl-4 pr-2 lg:pl-11">
          {detalhes && <p className="pb-2 text-xs text-ink-muted">{detalhes}</p>}
          {carros.length === 0 ? (
            <p className="border-t border-line py-3 text-sm text-ink-subtle">Sem veículo vinculado.</p>
          ) : (
            <ul aria-label={`Veículos de ${cliente.nome}`} className="divide-y divide-line border-t border-line">
              {carros.map((v) => {
                const meta = [v.marca, v.cor, v.km_atual != null ? `${Number(v.km_atual).toLocaleString('pt-BR')} km` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={v.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <PlateChip placa={v.placa} />
                        <span className="min-w-0 truncate text-sm font-medium text-ink">{v.modelo}</span>
                      </div>
                      {meta && <p className="mt-1 truncate text-xs text-ink-muted">{meta}</p>}
                    </div>
                    <AcoesVeiculo
                      placa={v.placa}
                      qtdOS={(osPorVeiculo[v.id] || []).length}
                      aoHistorico={() => aoHistoricoVeiculo(v)}
                      aoEditar={() => aoEditarVeiculo(v)}
                      aoAbrirOS={() => aoAbrirOS(v)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-line pt-2">
            <Button variante="fantasma" tamanho="sm" icone={Plus} onClick={aoAdicionarVeiculo}>
              Adicionar veículo
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
