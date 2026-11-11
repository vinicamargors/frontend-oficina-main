import { expect, test, type Page } from '@playwright/test';
import { abrirTela, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

// Fixtures `cheio` (dias atrás -> etapa): 0 ORC, 1 EXE, 2 AGP, 3 ORC, 4 EXE, 5 FIN, 6 AGP, 8 EXE, 9 ORC, 11 PAGO, 12 FIN, 15 PAGO.
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

async function abrirRadar(page: Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'radar');
}

const botaoPeriodo = (page: Page) => page.getByRole('button', { name: /^(Últimos|Período) / });
const lista = (page: Page) => page.getByRole('region', { name: 'Ordens abertas mais antigas' });
const linhas = (page: Page) => lista(page).getByRole('button').filter({ has: page.getByRole('img', { name: /^Placa / }) });

/** Período "só hoje": todas as ordens abertas de dias anteriores ficam de fora (7 no total). */
async function soHoje(page: Page) {
  const hoje = hojeSP();
  await botaoPeriodo(page).click();
  await page.getByRole('menuitemradio', { name: 'Personalizado' }).click();
  await page.getByLabel('De', { exact: true }).fill(hoje);
  await page.getByLabel('Até', { exact: true }).fill(hoje);
  await page.getByRole('button', { name: 'Aplicar' }).click();
}

test.describe('radar: lista das ordens abertas mais antigas', () => {
  test('mostra as ordens fora do período, da mais antiga para a mais nova, com placa e "parada há N dias"', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    // 7 dias: Orçamento de 9 dias e Em execução de 8 dias ficam de fora
    await expect(page.getByText('2 ordens abertas mais antigas ficam fora do período')).toBeVisible();
    await expect(linhas(page)).toHaveCount(2);
    // as ordens dos fixtures têm hora fixa; conforme a hora de hoje, 9 dias de calendário contam 8 ou 9 períodos de 24h
    await expect(linhas(page).nth(0)).toContainText(/parada há (8|9) dias/);
    await expect(linhas(page).nth(1)).toContainText(/parada há (7|8) dias/);
    await expect(linhas(page).nth(0).getByRole('img', { name: /^Placa / })).toBeVisible();
    await expect(linhas(page).nth(0)).toContainText('Orçamento');
    // mais de 7 dias em Orçamento: marcador com texto
    await expect(linhas(page).nth(0)).toContainText('Atrasado');
    await expect(linhas(page).nth(0)).toHaveAccessibleName(/Atrasado/);
    await expect(lista(page).getByRole('button', { name: /Ver todas/ })).toHaveCount(0);
    exigirRedeCompleta(page);
  });

  test('clicar numa linha abre a ordem', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    await linhas(page).first().click();
    await expect(page).toHaveURL(/tab=os/);
    await expect(page).toHaveURL(/osId=/);
    exigirRedeCompleta(page);
  });

  test('mais de 5: mostra 5 e "Ver todas (N)" abre Ordens sem filtro de etapa', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    await soHoje(page);
    await expect(page.getByText('7 ordens abertas mais antigas ficam fora do período')).toBeVisible();
    await expect(linhas(page)).toHaveCount(5);
    const dias = await linhas(page).evaluateAll((els) => els.map((e) => Number(/parada há (\d+) dias?/.exec(e.textContent || '')?.[1])));
    expect(dias).toEqual([...dias].sort((a, b) => b - a)); // da mais antiga para a mais nova
    expect([8, 9]).toContain(dias[0]);
    const todas = lista(page).getByRole('button', { name: 'Ver todas (7)' });
    await expect(todas).toBeVisible();
    await todas.click();
    await expect(page).toHaveURL(/tab=os/);
    await expect(page).not.toHaveURL(/status=/);
  });

  test('o título recolhe e expande a lista (aria-expanded) e não lembra a escolha', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    const titulo = page.getByRole('button', { name: /ordens abertas mais antigas ficam fora do período/ });
    await expect(titulo).toHaveAttribute('aria-expanded', 'true');
    await expect(linhas(page)).toHaveCount(2);
    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
    await expect(linhas(page)).toHaveCount(0);
    await expect(page.getByText('2 ordens abertas mais antigas ficam fora do período')).toBeVisible();
    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'true');
    await expect(linhas(page)).toHaveCount(2);

    await titulo.click();
    await page.reload();
    await expect(page.getByRole('button', { name: /ordens abertas mais antigas/ })).toHaveAttribute('aria-expanded', 'true');
  });

  test('some quando não há ordens abertas fora do período', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    await botaoPeriodo(page).click();
    await page.getByRole('menuitemradio', { name: '30 dias' }).click();
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 30 dias');
    await expect(page.getByText(/mais antigas? ficam? fora do período/)).toHaveCount(0);
    await expect(lista(page)).toHaveCount(0);
  });

  test('cada carregamento faz exatamente 9 leituras (8 de ordens + estoque)', async ({ page }, info) => {
    await abrirRadar(page, contextoDoProjeto(info).tema);
    await expect(linhas(page)).toHaveCount(2);
    let os = 0;
    let dashboard = 0;
    const aoRequisitar = (r: import('@playwright/test').Request) => {
      if (/\/os\/\?/.test(r.url())) os++;
      if (/\/dashboards\//.test(r.url())) dashboard++;
    };
    page.on('request', aoRequisitar);
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'false');
    await page.waitForTimeout(300);
    page.off('request', aoRequisitar);
    expect(os).toBe(8);
    expect(dashboard).toBe(1);
    // as 3 leituras do aviso pedem as mais antigas primeiro, no máximo 5, só ordens em aberto
    const pedidas: URLSearchParams[] = [];
    page.on('request', (r) => {
      if (/\/os\/\?/.test(r.url())) pedidas.push(new URL(r.url()).searchParams);
    });
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'false');
    const antes = pedidas.filter((q) => !q.get('data_inicio'));
    expect(antes.map((q) => q.get('status')).sort()).toEqual(['AGUARDANDO_PECA', 'EXECUCAO', 'ORCAMENTO']);
    for (const q of antes) {
      expect(q.get('ordenacao')).toBe('data_asc');
      expect(q.get('limit')).toBe('5');
    }
  });

  test('uma falha na leitura do aviso só esconde o aviso', async ({ page }, info) => {
    await simularBackend(page, 'cheio');
    await page.route(/\/os\/\?/, async (route) => {
      if (!new URL(route.request().url()).searchParams.get('data_inicio')) {
        await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
      } else await route.fallback();
    });
    await entrarComo(page, 'DONO', contextoDoProjeto(info).tema);
    await abrirTela(page, 'radar');
    await expect(page.getByRole('region', { name: 'Orçamento', exact: true })).toBeVisible();
    await expect(page.getByText(/mais antigas? ficam? fora do período/)).toHaveCount(0);
  });
});
