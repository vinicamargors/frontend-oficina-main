import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, estoque, simularBackend, usuarios } from './mocks';
import { contextoDoProjeto } from './contexto';

/**
 * Isolamento da impressão: com um bloco imprimível aberto (holerite, etiqueta, folha A4 da OS), o papel traz SÓ
 * esse bloco, nunca a tela por trás (ex.: a lista da equipe com o salário de todos).
 * Verificado de dois jeitos: o texto do PDF gerado pelo Chromium (`page.pdf` + `pdftotext`) e a visibilidade
 * calculada em `print`; e, na tela, nada muda.
 */

async function textoDoPdf(page: Page): Promise<{ texto: string; paginas: number }> {
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  const pasta = mkdtempSync(join(tmpdir(), 'impressao-'));
  const arquivo = join(pasta, 'saida.pdf');
  writeFileSync(arquivo, pdf);
  // depuração: PDF_DIR=<pasta> guarda cada PDF para olhar o papel
  if (process.env.PDF_DIR) writeFileSync(join(process.env.PDF_DIR, `${test.info().title.slice(0, 20)}-${test.info().project.name}.pdf`.replace(/[^\w.-]+/g, '_')), pdf);
  const texto = execFileSync('pdftotext', ['-layout', arquivo, '-'], { encoding: 'utf8' });
  const info = execFileSync('pdfinfo', [arquivo], { encoding: 'utf8' });
  const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? '0');
  return { texto: texto.replace(/\s+/g, ' '), paginas };
}

/** Elementos visíveis (em `print`) com texto fora da área imprimível. */
const visiveisForaDaArea = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((el) => !el.closest('.area-impressao') && !el.querySelector('.area-impressao'))
      .filter((el) => getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0)
      .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()))
      .map((el) => el.textContent!.trim().slice(0, 40))
  );

const TIAGO = usuarios[3];
const OUTROS = usuarios.filter((u) => u.id !== TIAGO.id);

test.describe('impressão isolada', () => {
  test.beforeEach(({}, info) => {
    test.skip(contextoDoProjeto(info).tema === 'escuro', 'o papel é o mesmo nos dois temas; uma passada basta por largura');
  });

  test('holerite: só o holerite do colaborador vai para o papel (sem a lista com salários da equipe)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'equipe');
    await page.getByRole('tab', { name: 'Folha' }).click();
    await page.getByRole('button', { name: `Ver holerite de ${TIAGO.nome}` }).click();
    await page.getByRole('dialog', { name: 'Holerite' }).locator('#holerite-impressao').waitFor();

    // na tela, nada muda: a lista por trás continua visível
    // com a folha modal aberta o resto é inerte (fora da árvore de acessibilidade): localizar pelo atributo
    const lista = page.locator('ul[aria-label="Folha do mês"]');
    expect(await lista.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');

    await page.emulateMedia({ media: 'print' });
    expect(await visiveisForaDaArea(page)).toEqual([]);
    expect(await lista.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    const cores = await page.locator('#holerite-impressao').evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    expect(cores).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);

    const { texto, paginas } = await textoDoPdf(page);
    expect(paginas).toBe(1);
    expect(texto).toContain(TIAGO.nome);
    expect(texto).toMatch(/R\$ ?4\.020,00/);
    expect(texto).toContain('Recibo de pagamento');
    for (const u of OUTROS) expect(texto).not.toContain(u.nome);
    expect(texto).not.toMatch(/R\$ ?5\.320,00/); // líquido dos outros
    expect(texto).not.toMatch(/R\$ ?19\.980,00/); // total da folha
    expect(texto).not.toContain('Imprimir holerite');
    expect(texto).not.toContain('Equipe & RH');

    // de volta à tela: tudo visível de novo
    await page.emulateMedia({ media: 'screen' });
    expect(await lista.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
  });

  test('sem bloco imprimível aberto, a impressão da tela não muda', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'equipe');
    await page.emulateMedia({ media: 'print' });
    const lista = page.getByRole('list', { name: 'Colaboradores' });
    expect(await lista.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
  });

  test('etiqueta do estoque: só a etiqueta da peça escolhida', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const PECA = estoque[0];
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'estoque');
    await page.getByRole('button', { name: `Mais ações de ${PECA.nome}` }).click();
    await page.getByRole('menuitem', { name: /Imprimir etiqueta/ }).click();
    await page.locator('#etiqueta-impressao').waitFor();
    await page.emulateMedia({ media: 'print' });
    expect(await visiveisForaDaArea(page)).toEqual([]);
    const { texto, paginas } = await textoDoPdf(page);
    expect(paginas).toBe(1);
    expect(texto).toContain(PECA.codigo!);
    for (const outra of estoque.slice(1)) expect(texto).not.toContain(outra.nome);
    expect(texto).not.toContain('Imprimir etiqueta');
  });

  test('folha A4 da OS: só a folha da OS, sem a tela da bancada nem a navegação', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'bancada');
    await page.emulateMedia({ media: 'print' });
    expect(await visiveisForaDaArea(page)).toEqual([]);
    const { texto } = await textoDoPdf(page);
    expect(texto).toContain('Retífica de discos');
    expect(texto).not.toContain('Radar do Pátio');
    expect(texto).not.toContain('Imprimir (A4)');
  });
});
