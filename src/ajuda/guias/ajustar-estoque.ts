import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_AJUSTAR_ESTOQUE: GuiaDef = {
  id: 'ajustar-estoque',
  titulo: 'Ajustar o estoque (entrada e saída)',
  resumo: 'Registre a chegada de peças e as baixas.',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['estoque', 'entrada', 'saída', 'peça', 'reposição', 'mínimo', 'etiqueta'],
  abas: ['estoque'],
  passos: [
    { texto: 'No menu, abra "Estoque de peças". O filtro "Crítico" mostra o que está no mínimo.' },
    { texto: 'Busque a peça pelo nome ou código.' },
    { texto: 'Toque no menu "…" da peça.' },
    { texto: 'Escolha "Registrar entrada" quando a peça chegar ou "Registrar saída" para dar baixa.' },
    { texto: 'Informe a quantidade e confirme. O saldo é atualizado na hora.' },
  ],
};
