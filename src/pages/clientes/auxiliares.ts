import { Cliente, Veiculo } from '../../types';

export const PAGE_SIZE = 50;

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

export function formatarDataCurta(iso?: string | null): string {
  if (!iso) return '—';
  // Data pura (AAAA-MM-DD) é interpretada como UTC pelo Date e recuaria um dia em BRT: monta como data local
  const pura = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = pura ? new Date(Number(pura[1]), Number(pura[2]) - 1, Number(pura[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function montarLinkWhatsApp(telefone?: string | null, nomeCliente?: string, placa?: string): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return null;
  const foneComDdi = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`;
  const saudacao = nomeCliente
    ? `Olá ${nomeCliente.split(' ')[0]}, tudo bem? Aqui é da oficina sobre${placa ? ` o veículo ${placa}` : ' seu atendimento'}.`
    : 'Olá, tudo bem? Aqui é da oficina.';
  return `https://wa.me/${foneComDdi}?text=${encodeURIComponent(saudacao)}`;
}

export function agruparPor<T>(itens: T[], chave: (item: T) => string | null | undefined): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of itens) {
    const k = chave(item);
    if (!k) continue;
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

// Filtro unificado por Nome, Telefone, CPF/CNPJ, Placa ou Modelo
export function filtrarClientes(
  clientes: Cliente[],
  veiculosPorCliente: Record<string, Veiculo[]>,
  busca: string
): Cliente[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return clientes;
  const termoAlfanum = termo.replace(/[^a-z0-9]/g, '');

  return clientes.filter((c) => {
    const nomeMatch = c.nome.toLowerCase().includes(termo);
    const telLimpo = (c.telefone || '').replace(/\D/g, '');
    const cpfLimpo = (c.cpf_cnpj || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const telMatch =
      (c.telefone || '').toLowerCase().includes(termo) ||
      (termoAlfanum.length >= 3 && telLimpo.includes(termoAlfanum));
    const cpfMatch =
      (c.cpf_cnpj || '').toLowerCase().includes(termo) ||
      (termoAlfanum.length >= 3 && cpfLimpo.includes(termoAlfanum));

    const carros = veiculosPorCliente[c.id] || [];
    const carroMatch = carros.some((v) => {
      const placaLower = v.placa.toLowerCase();
      const placaLimpa = placaLower.replace(/[^a-z0-9]/g, '');
      return (
        placaLower.includes(termo) ||
        (termoAlfanum.length >= 2 && placaLimpa.includes(termoAlfanum)) ||
        (v.modelo || '').toLowerCase().includes(termo) ||
        (v.marca || '').toLowerCase().includes(termo)
      );
    });

    return nomeMatch || telMatch || cpfMatch || carroMatch;
  });
}

export function filtrarVeiculos(
  veiculos: Veiculo[],
  clientePorId: Record<string, Cliente>,
  busca: string
): Veiculo[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return veiculos;
  const termoAlfanum = termo.replace(/[^a-z0-9]/g, '');

  return veiculos.filter((v) => {
    const placaLower = v.placa.toLowerCase();
    const placaLimpa = placaLower.replace(/[^a-z0-9]/g, '');
    const modeloMatch = (v.modelo || '').toLowerCase().includes(termo);
    const marcaMatch = (v.marca || '').toLowerCase().includes(termo);
    const dono = clientePorId[v.cliente_id];
    const nomeDono = (dono?.nome || v.clientes?.nome || '').toLowerCase();
    const telDono = (dono?.telefone || v.clientes?.telefone || '').replace(/\D/g, '');

    return (
      placaLower.includes(termo) ||
      (termoAlfanum.length >= 2 && placaLimpa.includes(termoAlfanum)) ||
      modeloMatch ||
      marcaMatch ||
      nomeDono.includes(termo) ||
      (termoAlfanum.length >= 3 && telDono.includes(termoAlfanum))
    );
  });
}

/** "Mostrando {inicio}–{fim} de {total}" e o número de páginas. */
export function faixaDaPagina(pagina: number, total: number, tamanho: number) {
  return {
    inicio: total === 0 ? 0 : (pagina - 1) * tamanho + 1,
    fim: Math.min(total, pagina * tamanho),
    totalPaginas: Math.max(1, Math.ceil(total / tamanho)),
  };
}
