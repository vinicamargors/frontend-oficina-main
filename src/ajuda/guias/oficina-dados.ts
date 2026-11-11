import type { GuiaDef } from '../tipos';

export const GUIA_OFICINA_DADOS: GuiaDef = {
  id: 'oficina-dados',
  titulo: 'Configurar os dados da oficina',
  resumo: 'Identificação, endereço, PIX, ponto por GPS e regras da folha.',
  cargos: ['DONO', 'master'],
  palavrasChave: ['oficina', 'pix', 'cnpj', 'endereço', 'cep', 'gps', 'raio', 'comissão', 'configurar'],
  abas: ['oficina'],
  passos: [
    { texto: 'No menu, abra "Dados da oficina".' },
    { texto: 'Em "Identificação", confira nome, documentos e contatos. Eles saem na ordem de serviço impressa.' },
    { texto: 'Em "Endereço", informe o CEP: o endereço e o pátio no mapa se preenchem sozinhos.' },
    {
      texto: 'Em "Pagamento (PIX)", informe a chave que o cliente usa para pagar.',
      imagem: { arquivo: '4.jpg', alvos: ['oficina-pix'], alt: 'Dados da oficina com a seção Pagamento PIX destacada' },
    },
    { texto: 'Em "Ponto (GPS)", defina o raio do pátio. A equipe só registra o ponto dentro dele.' },
    { texto: 'Em "Folha e comissões", ajuste as regras padrão. Depois toque em "Salvar alterações".' },
  ],
};
