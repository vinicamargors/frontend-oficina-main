import type { StatusOS, UltimaOS } from '../../types';
import { STATUS_OS } from '../../components/ui/status';
import { formatarPlaca } from '../../components/ui/PlateChip';

/** Etapas que viram coluna do quadro, na ordem do fluxo. "Pago / entregue" sai do pátio (marca-se na ordem). */
export const ETAPAS_QUADRO: StatusOS[] = ['ORCAMENTO', 'AGUARDANDO_PECA', 'EXECUCAO', 'FINALIZADO'];

export interface EtapaQuadro {
  items: UltimaOS[];
  total: number;
}

export type EtapasQuadro = Record<StatusOS, EtapaQuadro>;

/** Tipo do dado do arrasto (só o id da ordem; a origem fica no estado da tela). */
export const TIPO_ARRASTO = 'application/x-mecanify-os';

export function ehEtapaDoQuadro(status: string | null | undefined): status is StatusOS {
  return !!status && (ETAPAS_QUADRO as string[]).includes(status);
}

/** Para onde a ordem pode ir pelo quadro: as outras colunas, para frente ou para trás (como no passo a passo da OS). */
export function destinosDe(origem: StatusOS): StatusOS[] {
  if (!ehEtapaDoQuadro(origem)) return [];
  return ETAPAS_QUADRO.filter((st) => st !== origem);
}

/** Soltar só vale numa coluna do quadro diferente da de origem. */
export function podeSoltar(origem: StatusOS | null | undefined, destino: StatusOS | null | undefined): boolean {
  return ehEtapaDoQuadro(origem) && ehEtapaDoQuadro(destino) && origem !== destino;
}

// Mesma regra das etapas na tela da Ordem (OrdensServico): todos os cargos da oficina trocam a etapa.
const CARGOS_QUE_MUDAM_ETAPA = ['master', 'DONO', 'MECANICO', 'ATENDENTE', 'FINANCEIRO'];

export function podeMudarEtapa(cargo: string | null | undefined): boolean {
  return !!cargo && CARGOS_QUE_MUDAM_ETAPA.includes(cargo);
}

/**
 * Movimento otimista: tira a ordem da coluna `de` e a põe no topo de `para` com o novo status, acertando os totais.
 * Não muta o quadro recebido (ele é o que volta se a gravação falhar). Sem efeito, devolve o mesmo objeto.
 */
export function moverNoQuadro(etapas: EtapasQuadro, osId: string, de: StatusOS, para: StatusOS): EtapasQuadro {
  if (!podeSoltar(de, para)) return etapas;
  const origem = etapas[de];
  const os = origem?.items.find((o) => o.id === osId);
  if (!os) return etapas;
  const destino = etapas[para] ?? { items: [], total: 0 };
  return {
    ...etapas,
    [de]: { items: origem.items.filter((o) => o.id !== osId), total: Math.max(0, origem.total - 1) },
    [para]: { items: [{ ...os, status: para }, ...destino.items], total: destino.total + 1 },
  };
}

export function tituloMover(placa: string, para: StatusOS): string {
  return `Mover ${formatarPlaca(placa)} para ${STATUS_OS[para].rotulo}?`;
}

export function anuncioMovida(placa: string, para: StatusOS): string {
  return `${formatarPlaca(placa)} movida para ${STATUS_OS[para].rotulo}`;
}
