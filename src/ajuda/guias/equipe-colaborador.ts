import type { GuiaDef } from '../tipos';

export const GUIA_EQUIPE_COLABORADOR: GuiaDef = {
  id: 'equipe-colaborador',
  titulo: 'Cadastrar um colaborador e convidar',
  resumo: 'Registre a pessoa, defina o cargo e mande o convite pelo WhatsApp.',
  cargos: ['DONO', 'master'],
  palavrasChave: ['colaborador', 'equipe', 'rh', 'cargo', 'convite', 'whatsapp', 'funcionário', 'desativar'],
  abas: ['equipe'],
  passos: [
    { texto: 'No menu, abra "Equipe & RH". A aba "Equipe" lista todos os colaboradores.' },
    {
      texto: 'Toque em "Novo colaborador".',
      imagem: { arquivo: '2.jpg', alvos: ['equipe-novo'], alt: 'Tela de equipe com o botão Novo colaborador destacado' },
    },
    { texto: 'Informe nome, telefone e o cargo. O cargo define o que a pessoa vê: mecânico, atendente, financeiro ou dono.' },
    { texto: 'Preencha salário, comissão e hora extra quando quiser que entrem na folha. Se deixar em branco, valem as regras padrão da oficina.' },
    {
      texto: 'Salve. Para a pessoa criar o acesso, use "Convidar no WhatsApp" e envie a mensagem.',
      imagem: { arquivo: '5.jpg', alvos: ['equipe-convidar'], alt: 'Cabeçalho da equipe com o botão Convidar no WhatsApp destacado' },
    },
    { texto: 'Para encerrar o acesso, use "Desativar" na linha do colaborador. Dá para reativar depois.' },
  ],
};
