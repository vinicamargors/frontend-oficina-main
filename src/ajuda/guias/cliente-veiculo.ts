import type { GuiaDef } from '../tipos';
import { TODOS_OS_CARGOS } from '../tipos';

export const GUIA_CLIENTE_VEICULO: GuiaDef = {
  id: 'cliente-veiculo',
  titulo: 'Cadastrar cliente e veículo',
  resumo: 'Registre o cliente com os carros dele de uma vez.',
  cargos: TODOS_OS_CARGOS,
  palavrasChave: ['cliente', 'veículo', 'placa', 'cadastro', 'ficha', 'telefone'],
  abas: ['clientes', 'veiculos'],
  passos: [
    { texto: 'No menu, abra "Clientes & veículos".' },
    { texto: 'Toque em "Novo cliente".' },
    { texto: 'Informe nome e telefone (WhatsApp). CPF e endereço são opcionais.' },
    { texto: 'Em "Novo veículo", informe a placa, o modelo, a marca e a cor. Para outro carro do mesmo cliente, adicione mais um veículo.' },
    { texto: 'Salve. Para incluir um carro depois, use o menu "…" do cliente e "Adicionar veículo".' },
  ],
};
