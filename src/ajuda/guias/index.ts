import type { GuiaDef } from '../tipos';
import { GUIA_ABRIR_OS } from './abrir-os';
import { GUIA_ORCAMENTO_WHATSAPP } from './orcamento-whatsapp';
import { GUIA_MOVER_ETAPA } from './mover-etapa';
import { GUIA_RECEBER_PAGAMENTO } from './receber-pagamento';
import { GUIA_CLIENTE_VEICULO } from './cliente-veiculo';
import { GUIA_AJUSTAR_ESTOQUE } from './ajustar-estoque';
import { GUIA_CONTA_BAIXA } from './conta-baixa';

export const GUIAS: GuiaDef[] = [
  GUIA_ABRIR_OS,
  GUIA_ORCAMENTO_WHATSAPP,
  GUIA_MOVER_ETAPA,
  GUIA_RECEBER_PAGAMENTO,
  GUIA_CLIENTE_VEICULO,
  GUIA_AJUSTAR_ESTOQUE,
  GUIA_CONTA_BAIXA,
];
