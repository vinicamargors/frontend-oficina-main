import { expect, test } from '@playwright/test';
import { abrirTela, dashboard, entrarComo, exigirRedeCompleta, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';

const ETAPAS = ['Orçamento', 'Aguardando peça', 'Em execução', 'Finalizado'];

test.describe('radar do pátio', () => {
  test('quadro com 4 colunas; cards com placa e dias em aberto; atrasado tem texto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    for (const etapa of ETAPAS) {
      await expect(page.getByRole('region', { name: etapa, exact: true })).toBeVisible();
    }
    const orcamento = page.getByRole('region', { name: 'Orçamento', exact: true });
    const cards = orcamento.getByRole('button').filter({ has: page.getByRole('img', { name: /^Placa / }) });
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    await expect(cards.first().getByRole('img', { name: /^Placa / })).toBeVisible();
    await expect(cards.first()).toContainText(/aberta (há \d+ dias?|hoje)/);

    // o orçamento de 9 dias está atrasado e o texto diz isso (não só a cor)
    await expect(orcamento.getByText('Atrasado')).toHaveCount(1);
    await expect(orcamento.getByRole('button', { name: /Atrasado/ })).toHaveCount(1);
    // o aguardando peça de 6 dias pede atenção
    await expect(page.getByRole('region', { name: 'Aguardando peça', exact: true }).getByText('Atenção')).toHaveCount(1);
    exigirRedeCompleta(page);
  });

  test('coluna com contagem mas sem cards entre os 10 mais recentes não diz "Nenhum veículo"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await page.route('**/dashboards/*', async (route) => {
      const base = dashboard('cheio');
      const corpo = {
        ...base,
        status_counts: { ...base.status_counts, FINALIZADO: 5 },
        ultimas_os: base.ultimas_os.filter((o) => o.status !== 'FINALIZADO'),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(corpo),
      });
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    const finalizado = page.getByRole('region', { name: 'Finalizado', exact: true });
    await expect(finalizado.getByText('Nenhum veículo')).toHaveCount(0);
    await expect(finalizado.getByRole('button', { name: /5 veículos, ver todas/ })).toBeVisible();
    // as outras colunas continuam com cards e o aviso de "mais recentes" só aparece onde falta card
    await expect(page.getByRole('region', { name: 'Orçamento', exact: true }).getByText(/Mostrando as/)).toHaveCount(0);
  });

  test('topo com exatamente 3 números e sem rolagem horizontal da página', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    const resumo = page.getByRole('group', { name: 'Resumo do pátio' });
    await expect(resumo.getByRole('button')).toHaveCount(3);
    for (const caixa of await resumo.getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(caixa).toBeGreaterThanOrEqual(44);
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
  });

  test('no celular o quadro rola na horizontal por dentro, sem mexer na página', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');
    const quadro = page.getByTestId('quadro-patio');
    const { rolavel, sobraPagina } = await quadro.evaluate((el) => ({
      rolavel: el.scrollWidth > el.clientWidth,
      sobraPagina: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(rolavel).toBe(true);
    expect(sobraPagina).toBeLessThanOrEqual(0);
  });

  test('clicar no card abre a ordem de serviço', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');
    await page.getByRole('region', { name: 'Em execução', exact: true }).getByRole('button').filter({ has: page.getByRole('img', { name: /^Placa / }) }).first().click();
    await expect(page).toHaveURL(/tab=os/);
    await expect(page).toHaveURL(/osId=/);
    exigirRedeCompleta(page);
  });

  test('pátio vazio: texto curto e a ação principal', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'vazio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'radar');

    await expect(page.getByText('Nenhum veículo no pátio')).toBeVisible();
    const acao = page.getByRole('button', { name: 'Nova ordem de serviço' });
    await expect(acao).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Orçamento', exact: true })).toHaveCount(0);
    await acao.click();
    await expect(page).toHaveURL(/tab=os/);
    exigirRedeCompleta(page);
  });
});
