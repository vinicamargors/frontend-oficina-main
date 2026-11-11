import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_ORCAMENTO_WHATSAPP: GuiaDef = {
  id: 'orcamento-whatsapp',
  titulo: 'Montar o orçamento e enviar no WhatsApp',
  resumo: 'Lance peças e mão de obra e mande o orçamento para o cliente.',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['orçamento', 'whatsapp', 'peças', 'mão de obra', 'itens', 'imprimir'],
  abas: ['os'],
  passos: [
    { texto: 'Em "Ordens de serviço", toque na ordem para abrir a bancada.' },
    {
      texto: 'Em "Lançar item", escolha o tipo: peça do estoque, peça avulsa, mão de obra ou terceirizado.',
      imagem: { arquivo: '2.jpg', alvos: ['os-lancar-item'], alt: 'Bancada da ordem com o bloco Lançar item destacado' },
    },
    { texto: 'Preencha a descrição, a quantidade e o valor e confirme. O total da ordem é atualizado.' },
    { texto: 'Confira os itens lançados. Para corrigir um valor, edite o item e use "Salvar edição".' },
    {
      texto: 'Toque em "WhatsApp" para mandar o orçamento ao cliente. Se preferir papel, use "Imprimir (A4)".',
      imagem: { arquivo: '5.jpg', alvos: ['os-whatsapp'], alt: 'Cabeçalho da bancada com o botão WhatsApp destacado' },
    },
  ],
};
