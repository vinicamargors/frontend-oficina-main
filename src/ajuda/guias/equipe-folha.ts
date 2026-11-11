import type { GuiaDef } from '../tipos';

export const GUIA_EQUIPE_FOLHA: GuiaDef = {
  id: 'equipe-folha',
  titulo: 'Folha de pagamento e holerite',
  resumo: 'Confira o total do mês, imprima o holerite e lance nas contas a pagar.',
  cargos: ['DONO', 'master'],
  palavrasChave: ['folha', 'holerite', 'salário', 'comissão', 'hora extra', 'pagamento', 'contas a pagar'],
  abas: ['equipe'],
  passos: [
    {
      texto: 'Em "Equipe & RH", abra a aba "Folha".',
      imagem: { arquivo: '1.jpg', alvos: ['equipe-abas'], alt: 'Abas da equipe: Equipe, Folha, Escalas, Ponto e Avaliações' },
    },
    { texto: 'Veja o total da folha e o valor líquido de cada colaborador. "Não informado" indica que falta o salário no cadastro.' },
    { texto: 'Toque em "Holerite" na linha da pessoa para abrir o holerite e use "Imprimir". Sai só o holerite dela.' },
    { texto: 'Para registrar o gasto no financeiro, toque em "Lançar em contas a pagar" e confirme.' },
  ],
};
