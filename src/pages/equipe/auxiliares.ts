import type { CargoUsuario, EscalaFolga, RegistroPonto, Usuario } from '../../types';

// Rótulos só para exibição: o valor enviado ao backend continua o enum (ex.: "MECANICO").
const ROTULOS_CARGO: Record<string, string> = {
  DONO: 'Dono',
  MECANICO: 'Mecânico',
  ATENDENTE: 'Atendente',
  FINANCEIRO: 'Financeiro',
  master: 'Administrador',
};

const ROTULOS_ESCALA: Record<EscalaFolga['tipo'], string> = {
  FERIAS: 'Férias',
  FOLGA: 'Folga',
  ATESTADO: 'Atestado',
  PLANTAO: 'Plantão',
};

const ROTULOS_PONTO: Record<RegistroPonto['tipo'], string> = {
  ENTRADA: 'Entrada',
  ALMOCO_SAIDA: 'Saída para almoço',
  ALMOCO_RETORNO: 'Volta do almoço',
  SAIDA: 'Saída',
};

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const rotuloCargo = (cargo?: CargoUsuario | string | null): string =>
  cargo ? ROTULOS_CARGO[cargo] ?? capitalizar(cargo) : 'Colaborador';

export const rotuloTipoEscala = (tipo: string): string =>
  ROTULOS_ESCALA[tipo as EscalaFolga['tipo']] ?? capitalizar(tipo);

export const rotuloTipoPonto = (tipo: string): string =>
  ROTULOS_PONTO[tipo as RegistroPonto['tipo']] ?? capitalizar(tipo);

const umaCasa = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** Nota em texto ("4 de 5", "4,6 de 5"): as estrelas nunca ficam só como ícone/cor. */
export const rotuloNota = (nota: number): string => `${umaCasa(nota)} de 5`;

/** Média com uma casa (exibição); `null` sem notas. */
export const mediaNotas = (notas: number[]): number | null =>
  notas.length === 0 ? null : Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10;

export const formatMedia = (media: number): string => media.toFixed(1).replace('.', ',');

/** Primeira letra do primeiro e do último nome. */
export const iniciais = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}${ultima}`.toUpperCase();
};

export const formatHora = (hora: string): string => (/^\d{2}:\d{2}:\d{2}$/.test(hora) ? hora.slice(0, 5) : hora);

export const formatBRL = (valor?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(valor || 0)
  );

/** Acréscimo sempre com "+" escrito (nunca só cor). */
export const comMais = (valor: number) => `+ ${formatBRL(valor)}`;

export const formatData = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso.slice(0, 10);
  }
};

// ------------------------------------------------------------ regras (mesmas da tela antiga, só extraídas)

/** Líquido do colaborador na folha: salário (se informado) + VT + VR. Comissões ainda não entram (sem valores fictícios). */
export const totalFolhaColaborador = (
  u: Pick<Usuario, 'salario_base' | 'vale_transporte' | 'vale_refeicao'>
): number => {
  const salario = (u.salario_base && u.salario_base > 0) ? u.salario_base : 0;
  const vt = u.vale_transporte || 0;
  const vr = u.vale_refeicao || 0;
  return salario + vt + vr;
};

/** Vencimento da folha: mês seguinte ao de referência ("AAAA-MM"), no dia de pagamento. */
export const vencimentoFolha = (mesFolhaRef: string, diaPagamento: number): string => {
  const [ano, mes] = mesFolhaRef.split('-');
  const proximoMes = parseInt(mes, 10) === 12 ? 1 : parseInt(mes, 10) + 1;
  const proximoAno = parseInt(mes, 10) === 12 ? parseInt(ano, 10) + 1 : parseInt(ano, 10);
  return `${proximoAno}-${String(proximoMes).padStart(
    2,
    '0'
  )}-${String(diaPagamento).padStart(2, '0')}`;
};

// Cálculo de distância entre dois pontos GPS em metros (Fórmula de Haversine)
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ------------------------------------------------------------ holerite (só exibição)

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-11" → "novembro de 2026" (pt-BR fixo, sem depender do idioma do navegador). Valor inválido volta como veio. */
export const formatMesExtenso = (mesRef: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(mesRef || '');
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${mes} de ${m[1]}` : mesRef || '';
};

/** Máscara de CNPJ só quando o valor guardado tem exatamente 14 dígitos; caso contrário, o texto como está. */
export const formatarCnpj = (cnpj?: string | null): string => {
  const v = (cnpj ?? '').trim();
  return /^\d{14}$/.test(v) ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v;
};

export const NOME_PADRAO_HOLERITE = 'MECANIFY • OFICINA MECÂNICA';

/** Cabeçalho do holerite: razão social, senão nome fantasia, senão o texto padrão; CNPJ só se houver. */
export const identidadeHolerite = (
  e?: { razao_social?: string | null; nome_fantasia?: string | null; cnpj?: string | null } | null
): { nome: string; cnpj: string } => ({
  nome: e?.razao_social?.trim() || e?.nome_fantasia?.trim() || NOME_PADRAO_HOLERITE,
  cnpj: formatarCnpj(e?.cnpj),
});
