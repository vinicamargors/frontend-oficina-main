import { describe, expect, it } from 'vitest';
import { passosVisiveis, posicionarCartao } from '../../src/tour/posicao';

const vp = { w: 1440, h: 900 };
describe('posicionarCartao', () => {
  it('abaixo quando cabe', () => {
    expect(posicionarCartao({ top: 100, left: 200, width: 100, height: 40 }, vp, false, 0).modo).toBe('abaixo');
  });
  it('acima quando não cabe abaixo', () => {
    const r = posicionarCartao({ top: 800, left: 200, width: 100, height: 40 }, vp, false, 0);
    expect(r.modo).toBe('acima');
    expect(r.top).toBeLessThan(800);
  });
  it('celular: base, acima da barra', () => {
    const r = posicionarCartao({ top: 100, left: 20, width: 100, height: 40 }, { w: 390, h: 844 }, true, 72);
    expect(r.modo).toBe('base');
    expect(r.top + 220).toBeLessThanOrEqual(844 - 72);
  });
  it('não sai da tela pela direita', () => {
    const r = posicionarCartao({ top: 100, left: 1400, width: 30, height: 30 }, vp, false, 0);
    expect(r.left + 340).toBeLessThanOrEqual(1440);
  });
});

describe('passosVisiveis', () => {
  it('ignora alvo ausente e alvo sem tamanho', () => {
    document.body.innerHTML = '<div data-tour="a"></div><div data-tour="b"></div>';
    const [a, b] = Array.from(document.querySelectorAll<HTMLElement>('[data-tour]'));
    a.getBoundingClientRect = () => ({ width: 10, height: 10 }) as DOMRect;
    b.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    const def = {
      id: 't',
      versao: 1,
      passos: ['a', 'b', 'c'].map((alvo) => ({ id: alvo, alvo, titulo: alvo, texto: alvo })),
    };
    expect(passosVisiveis(def, document).map((p) => p.alvo)).toEqual(['a']);
  });
});
