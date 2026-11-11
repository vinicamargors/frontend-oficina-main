import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { entrarComo, simularBackend } from '../mocks';
import { ROTEIROS, medirAlvo, type Foto } from './roteiros';

/**
 * Gera os prints limpos e as caixas de anotação dos guias de ajuda.
 *   npm run ajuda:prints   → grava public/ajuda/** e src/ajuda/anotacoes.json
 *   npm run ajuda:check    → só mede e compara as caixas (tolerância de 2%); não grava nada
 * Sem uma das variáveis, o spec é ignorado (não roda na suíte normal).
 */
const GERAR = process.env.AJUDA_PRINTS === '1';
const CHECAR = process.env.AJUDA_CHECK === '1';
const RAIZ = process.cwd();
const ARQ_NOTAS = join(RAIZ, 'src', 'ajuda', 'anotacoes.json');
const TOLERANCIA = 2;
// Recorte: sem o menu lateral (240px + folga), só a área de conteúdo, para o print ficar legível no celular
const RECORTE = { x: 256, y: 0, width: 1184, height: 900 };

type Caixa = { x: number; y: number; w: number; h: number };

test.describe.configure({ mode: 'serial' });
test.skip(!GERAR && !CHECAR, 'só com AJUDA_PRINTS=1 ou AJUDA_CHECK=1');

test('prints e anotações dos guias', async ({ browser }, info) => {
  test.skip(info.project.name !== 'claro-1440', 'só no projeto claro-1440');
  const existente: Record<string, Record<string, Caixa>> = existsSync(ARQ_NOTAS) ? JSON.parse(readFileSync(ARQ_NOTAS, 'utf8')) : {};
  const novo: Record<string, Record<string, Caixa>> = {};
  const divergencias: string[] = [];

  for (const [guia, roteiro] of Object.entries(ROTEIROS)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', 'claro');
    const foto: Foto = async (n, alvos) => {
      await page.waitForTimeout(150);
      const caixas: Record<string, Caixa> = {};
      for (const alvo of alvos) {
        const c = await medirAlvo(page, alvo);
        expect(c, `alvo ${alvo} do guia ${guia} passo ${n} não está visível`).not.toBeNull();
        caixas[alvo] = {
          x: +(((c!.x - RECORTE.x) / RECORTE.width) * 100).toFixed(2),
          y: +(((c!.y - RECORTE.y) / RECORTE.height) * 100).toFixed(2),
          w: +((c!.w / RECORTE.width) * 100).toFixed(2),
          h: +((c!.h / RECORTE.height) * 100).toFixed(2),
        };
      }
      const chave = `${guia}/${n}`;
      novo[chave] = caixas;
      if (CHECAR) {
        const antes = existente[chave];
        for (const alvo of alvos) {
          const a = antes?.[alvo];
          const b = caixas[alvo];
          const mudou = !a || (['x', 'y', 'w', 'h'] as const).some((k) => Math.abs(a[k] - b[k]) > TOLERANCIA);
          if (mudou) divergencias.push(`${chave} → ${alvo}`);
        }
        return;
      }
      const arquivo = join(RAIZ, 'public', 'ajuda', guia, `${n}.jpg`);
      mkdirSync(dirname(arquivo), { recursive: true });
      await page.screenshot({ path: arquivo, type: 'jpeg', quality: 82, clip: RECORTE });
    };
    await roteiro(page, foto);
    await ctx.close();
  }

  if (CHECAR) {
    const faltando = Object.keys(existente).filter((k) => !(k in novo));
    expect(divergencias, `Caixas mudaram. Rode: npm run ajuda:prints\n${divergencias.join('\n')}`).toEqual([]);
    expect(faltando, 'anotações de passos que não existem mais').toEqual([]);
    return;
  }
  writeFileSync(ARQ_NOTAS, JSON.stringify(novo, null, 2) + '\n');
});
