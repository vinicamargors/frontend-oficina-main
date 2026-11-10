import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';
import { urlIgnoradaNoConsole } from './mocks/rede';

export type Tema = 'claro' | 'escuro';

/** Tema e largura vêm do nome do projeto (`claro-1440`, `escuro-390`...). */
export function contextoDoProjeto(info: TestInfo): { tema: Tema; largura: number } {
  const [tema, largura] = info.project.name.split('-');
  return { tema: tema as Tema, largura: Number(largura) };
}

/** Coleta erros de console e exceções da página; ignora falhas de hosts externos abortados de propósito. */
export function coletarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    if (urlIgnoradaNoConsole(m.location().url)) return;
    erros.push(`console.error: ${m.text()} (${m.location().url})`);
  });
  return erros;
}
