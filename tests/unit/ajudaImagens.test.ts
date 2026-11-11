import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIAS } from '../../src/ajuda/guias';
import notas from '../../src/ajuda/anotacoes.json';

const MOCKS = readFileSync(join(process.cwd(), 'e2e/mocks/fixtures.ts'), 'utf8');

describe('imagens dos guias', () => {
  const comImagem = GUIAS.flatMap((g) => g.passos.map((p, i) => ({ g, i, img: p.imagem })).filter((x) => x.img));
  it('toda imagem declarada existe, cabe no orçamento e tem caixa para cada alvo', () => {
    let total = 0;
    for (const { g, i, img } of comImagem) {
      const arq = join(process.cwd(), 'public/ajuda', g.id, img!.arquivo);
      expect(existsSync(arq), arq).toBe(true);
      const tam = statSync(arq).size;
      expect(tam, arq).toBeLessThanOrEqual(150 * 1024);
      total += tam;
      const caixas = (notas as Record<string, Record<string, unknown>>)[`${g.id}/${i + 1}`];
      for (const alvo of img!.alvos) expect(caixas?.[alvo], `${g.id}/${i + 1} ${alvo}`).toBeTruthy();
      expect(img!.alt.length).toBeGreaterThan(10);
    }
    expect(total).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
  it('anotações só de passos que existem', () => {
    for (const chave of Object.keys(notas)) {
      const [id, n] = chave.split('/');
      const g = GUIAS.find((x) => x.id === id);
      expect(g, chave).toBeTruthy();
      expect(g!.passos[Number(n) - 1]?.imagem, chave).toBeTruthy();
    }
  });
  it('textos dos guias não citam dados reais (só termos genéricos)', () => {
    const texto = JSON.stringify(GUIAS);
    expect(texto).not.toMatch(/autotec|racing|\d{3}\.\d{3}\.\d{3}-\d{2}|@\w+\.\w+/i);
    expect(MOCKS.length).toBeGreaterThan(0);
  });
});
