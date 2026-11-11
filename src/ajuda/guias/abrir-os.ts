import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_ABRIR_OS: GuiaDef = {
  id: 'abrir-os',
  titulo: 'Abrir uma ordem de serviço',
  resumo: 'Dê entrada num veículo e registre o defeito (OS = ordem de serviço).',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['os', 'nova ordem', 'entrada', 'veículo', 'defeito', 'abrir'],
  abas: ['patio', 'os'],
  passos: [
    { texto: 'No menu, abra "Ordens de serviço" ou use o botão "Nova OS" do Radar.' },
    {
      texto: 'Toque em "Nova ordem de serviço".',
      imagem: { arquivo: '2.jpg', alvos: ['ordens-nova'], alt: 'Tela de ordens de serviço com o botão Nova ordem de serviço destacado no canto superior direito' },
    },
    { texto: 'Procure o cliente pelo nome, telefone, CPF ou placa. Se ele ainda não existe, use "+ Novo cliente".' },
    { texto: 'Escolha o veículo do cliente. Se for um carro novo, use "+ Novo veículo" e informe a placa.' },
    { texto: 'Descreva o defeito relatado pelo cliente e salve. A ordem nasce na etapa "Orçamento".' },
  ],
};
