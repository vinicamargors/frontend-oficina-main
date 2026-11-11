import { describe, expect, it } from 'vitest';
import {
  faixaDaPagina,
  filtrarClientes,
  filtrarVeiculos,
  montarLinkWhatsApp,
  agruparPor,
  formatarDataCurta,
} from '../../src/pages/clientes/auxiliares';
import type { Cliente, Veiculo } from '../../src/types';

const cli = (id: string, nome: string, telefone: string, cpf_cnpj?: string): Cliente => ({
  id,
  nome,
  telefone,
  cpf_cnpj,
  empresa_id: 'e1',
});
const vei = (id: string, placa: string, modelo: string, cliente_id: string, marca = ''): Veiculo =>
  ({ id, placa, modelo, marca, cliente_id, empresa_id: 'e1' }) as Veiculo;

const clientes = [cli('c1', 'João Pereira', '(11) 97000-1000', '123.456.789-00'), cli('c2', 'Ana Costa', '(11) 98111-2000')];
const veiculos = [vei('v1', 'ABC1D23', 'Gol', 'c1', 'Volkswagen'), vei('v2', 'QWE4R56', 'Corolla', 'c2', 'Toyota')];

describe('montarLinkWhatsApp', () => {
  it('sem telefone válido não há link', () => {
    expect(montarLinkWhatsApp('', 'Ana')).toBeNull();
    expect(montarLinkWhatsApp('123', 'Ana')).toBeNull();
  });
  it('acrescenta o DDI 55 e cita o primeiro nome e a placa', () => {
    const url = montarLinkWhatsApp('(11) 97000-1000', 'João Pereira', 'ABC1D23')!;
    expect(url.startsWith('https://wa.me/5511970001000?text=')).toBe(true);
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).toContain('Olá João');
    expect(texto).toContain('ABC1D23');
  });
  it('não duplica o DDI', () => {
    expect(montarLinkWhatsApp('5511970001000')!).toContain('wa.me/5511970001000');
  });
});

describe('filtros', () => {
  const porCliente = agruparPor(veiculos, (v) => v.cliente_id);
  it('agrupa veículos por cliente', () => {
    expect(porCliente.c1.map((v) => v.id)).toEqual(['v1']);
  });
  it('clientes: por nome, telefone, CPF, placa e modelo; vazio devolve todos', () => {
    expect(filtrarClientes(clientes, porCliente, '')).toHaveLength(2);
    expect(filtrarClientes(clientes, porCliente, 'ana').map((c) => c.id)).toEqual(['c2']);
    expect(filtrarClientes(clientes, porCliente, '97000').map((c) => c.id)).toEqual(['c1']);
    expect(filtrarClientes(clientes, porCliente, '12345678900').map((c) => c.id)).toEqual(['c1']);
    expect(filtrarClientes(clientes, porCliente, 'abc-1d23').map((c) => c.id)).toEqual(['c1']);
    expect(filtrarClientes(clientes, porCliente, 'corolla').map((c) => c.id)).toEqual(['c2']);
  });
  it('veículos: por placa, modelo, marca e dono', () => {
    const porId = Object.fromEntries(clientes.map((c) => [c.id, c]));
    expect(filtrarVeiculos(veiculos, porId, 'toyota').map((v) => v.id)).toEqual(['v2']);
    expect(filtrarVeiculos(veiculos, porId, 'joão').map((v) => v.id)).toEqual(['v1']);
    expect(filtrarVeiculos(veiculos, porId, 'qwe4').map((v) => v.id)).toEqual(['v2']);
  });
});

describe('faixaDaPagina', () => {
  it('calcula "Mostrando A–B de TOTAL"', () => {
    expect(faixaDaPagina(1, 120, 50)).toEqual({ inicio: 1, fim: 50, totalPaginas: 3 });
    expect(faixaDaPagina(3, 120, 50)).toEqual({ inicio: 101, fim: 120, totalPaginas: 3 });
    expect(faixaDaPagina(1, 0, 50)).toEqual({ inicio: 0, fim: 0, totalPaginas: 1 });
  });
});

describe('formatarDataCurta', () => {
  it('data pura AAAA-MM-DD não recua um dia em BRT', () => {
    const antes = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      expect(formatarDataCurta('2026-11-10')).toBe('10/11/2026');
      expect(formatarDataCurta('2026-01-01')).toBe('01/01/2026');
    } finally {
      if (antes === undefined) delete process.env.TZ;
      else process.env.TZ = antes;
    }
  });
  it('timestamps e vazios continuam como antes', () => {
    expect(formatarDataCurta('2026-11-10T15:00:00Z')).toBe('10/11/2026');
    expect(formatarDataCurta(null)).toBe('—');
    expect(formatarDataCurta('lixo')).toBe('—');
  });
});
