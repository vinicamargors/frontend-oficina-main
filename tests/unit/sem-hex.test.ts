import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Exceções permitidas pela spec: PlateChip (identidade da placa) e blocos de impressão.
const EXCECOES = [/ui[\\/]PlateChip\.tsx$/];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

function semBlocoImpressao(src: string): string {
  return src.replace(/codemod:ignore-start[\s\S]*?codemod:ignore-end/g, '');
}

describe('sem hex em src/**/*.tsx', () => {
  it('nenhum hex fora das exceções', () => {
    const achados: string[] = [];
    for (const arq of arquivos(resolve(process.cwd(), 'src'))) {
      if (EXCECOES.some((r) => r.test(arq))) continue;
      semBlocoImpressao(readFileSync(arq, 'utf8')).split('\n').forEach((linha, i) => {
        if (/\[#[0-9a-fA-F]{3,8}\]|#[0-9a-fA-F]{6}\b/.test(linha)) achados.push(`${arq}:${i + 1}: ${linha.trim()}`);
      });
    }
    expect(achados).toEqual([]);
  });
});

describe('sem text-white em src/**/*.tsx', () => {
  it('botões/selos sólidos usam o token text-on-solid', () => {
    const achados: string[] = [];
    for (const arq of arquivos(resolve(process.cwd(), 'src'))) {
      if (EXCECOES.some((r) => r.test(arq))) continue;
      semBlocoImpressao(readFileSync(arq, 'utf8')).split('\n').forEach((linha, i) => {
        if (/\btext-white\b/.test(linha)) achados.push(`${arq}:${i + 1}: ${linha.trim()}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
