import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function bloco(seletor: RegExp): Record<string, [number, number, number]> {
  const m = css.match(seletor);
  if (!m) throw new Error(`bloco ${seletor} não encontrado em tokens.css`);
  const out: Record<string, [number, number, number]> = {};
  for (const [, nome, r, g, b] of m[1].matchAll(/--c-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[nome] = [Number(r), Number(g), Number(b)];
  }
  return out;
}

function luminancia([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function razao(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const BRANCO: [number, number, number] = [255, 255, 255];
const temas = {
  claro: () => bloco(/:root\s*\{([^}]*)\}/),
  escuro: () => bloco(/\.dark\s*\{([^}]*)\}/),
};

for (const [nome, ler] of Object.entries(temas)) {
  describe(`contraste (${nome})`, () => {
    const t = ler();
    const par = (fg: string, bg: string, min: number) =>
      it(`${fg} sobre ${bg} >= ${min}`, () => {
        expect(t[fg], `token ${fg}`).toBeDefined();
        expect(t[bg], `token ${bg}`).toBeDefined();
        expect(razao(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
      });

    for (const fg of ['ink', 'ink-muted', 'brand-ink', 'danger', 'success', 'warning', 'info', 'done']) {
      for (const bg of ['canvas', 'surface', 'muted']) par(fg, bg, 4.5);
    }
    for (const bg of ['canvas', 'surface', 'muted']) par('ink-subtle', bg, 4.5);
    par('line-strong', 'sunken', 3);
    par('line-strong', 'surface', 3);
    par('on-brand', 'brand', 4.5);
    par('on-solid', 'danger-solid', 4.5);
    par('on-solid', 'success-solid', 4.5);
    for (const bg of ['danger-solid', 'success-solid']) {
      it(`branco sobre ${bg} >= 4.5`, () => {
        expect(razao(BRANCO, t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
