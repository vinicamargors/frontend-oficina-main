import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_MOVER_ETAPA: GuiaDef = {
  id: 'mover-etapa',
  titulo: 'Mover a OS de etapa',
  resumo: 'Do orçamento até o pagamento, inclusive arrastando o card no Radar.',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['etapa', 'status', 'arrastar', 'radar', 'aprovar', 'execução', 'finalizar'],
  abas: ['patio', 'os'],
  passos: [
    { texto: 'As etapas são: Orçamento, Aguardando peça, Em execução, Finalizado e Pago.' },
    { texto: 'No Radar do pátio no computador, arraste o card do veículo para a coluna da próxima etapa.' },
    { texto: 'No celular, toque no menu "…" do card e escolha a nova etapa.' },
    { texto: 'Em "Ordens de serviço", use o botão da linha, como "Aprovar → Execução" ou "Concluir serviço".' },
    { texto: 'O sistema sempre pede confirmação antes de mudar. Cancelar não altera nada.' },
  ],
};
