import { expect, test, type Page } from '@playwright/test';
import { OS_BANCADA_ID, abrirTela, dossie, entrarComo, exigirRedeCompleta, ordens, simularBackend } from './mocks';
import { coletarErros, contextoDoProjeto } from './contexto';

// As opções da folha são exatamente as strings de FORMAS_PAGAMENTO (src/pages/OrdensServico.tsx).
const FORMAS = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto / Faturado'];
const ROTULOS = ['Orçamento', 'Aguardando peça', 'Em execução', 'Finalizado', 'Pago / entregue'];

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> } | undefined;
const ultimaEscrita = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita as Escrita);

// Total da OS da bancada no cenário cheio: peças 169,90 + 2×289 + mão de obra 320 + terceirizado 150.
const TOTAL_BANCADA = /R\$\s1\.217,90/;

async function abrirBancada(page: Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'bancada');
}

const etapas = (page: Page) => page.getByRole('list', { name: 'Etapas da ordem de serviço' });
const folha = (page: Page) => page.getByRole('dialog', { name: 'Confirmar pagamento' });
const folhaEtapa = (page: Page) => page.getByRole('dialog', { name: /^Mover para / });

test.describe('bancada: confirmação do Pago', () => {
  test('clicar em Pago abre a folha com o total; confirmar envia a forma escolhida', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrirBancada(page, tema);

    await etapas(page).getByRole('button', { name: 'Pago / entregue', exact: true }).click();
    const dialogo = folha(page);
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(TOTAL_BANCADA);
    await expect(folhaEtapa(page)).toHaveCount(0); // Pago usa só a folha de pagamento, nunca as duas

    const confirmar = dialogo.getByRole('button', { name: 'Confirmar pagamento' });
    await expect(confirmar).toBeDisabled();

    const radios = dialogo.getByRole('radio');
    await expect(radios).toHaveCount(FORMAS.length);
    for (const forma of FORMAS) {
      const r = dialogo.getByRole('radio', { name: forma, exact: true });
      await expect(r).not.toBeChecked();
      const alt = (await r.locator('xpath=ancestor::label').boundingBox())!.height;
      expect(alt).toBeGreaterThanOrEqual(44);
    }
    expect(await ultimaEscrita(page)).toBeUndefined();

    await dialogo.getByRole('radio', { name: 'Dinheiro', exact: true }).check();
    await expect(confirmar).toBeEnabled();
    await confirmar.click();
    await expect(dialogo).toBeHidden();

    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const escrita = (await ultimaEscrita(page))!;
    // A API do app usa PUT em /os/<empresa>/<os> (atualizarOS); o corpo é o que importa.
    expect(escrita.metodo).toMatch(/^(PUT|PATCH)$/);
    expect(escrita.caminho).toContain(`/os/`);
    expect(escrita.caminho).toContain(OS_BANCADA_ID);
    expect(escrita.corpo).toEqual({ status: 'PAGO', forma_pagamento: 'Dinheiro' });

    const aviso = page.getByRole('status').filter({ hasText: 'Ordem marcada como paga' });
    await expect(aviso).toBeVisible();
    await expect(aviso).not.toContainText('PAGO');
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('Cancelar, Escape e clique fora fecham sem escrever nada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirBancada(page, tema);
    const pago = etapas(page).getByRole('button', { name: 'Pago / entregue', exact: true });

    await pago.click();
    await folha(page).getByRole('radio', { name: 'PIX', exact: true }).check();
    await folha(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha(page)).toBeHidden();
    expect(await ultimaEscrita(page)).toBeUndefined();

    await pago.click();
    await expect(folha(page)).toBeVisible();
    // reabre sem a escolha anterior
    await expect(folha(page).getByRole('radio', { name: 'PIX', exact: true })).not.toBeChecked();
    await page.keyboard.press('Escape');
    await expect(folha(page)).toBeHidden();
    expect(await ultimaEscrita(page)).toBeUndefined();

    await pago.click();
    await expect(folha(page)).toBeVisible();
    await page.mouse.click(4, 4); // fundo (backdrop)
    await expect(folha(page)).toBeHidden();
    expect(await ultimaEscrita(page)).toBeUndefined();

    // a etapa atual continua "Em execução"
    await expect(etapas(page).locator('[aria-current="step"]')).toHaveAccessibleName('Em execução');
  });

  test('OS que já tem forma de pagamento: a folha abre sem nenhuma opção marcada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await page.route(`**/os/*/${OS_BANCADA_ID}/imprimir`, async (route) => {
      const base = dossie('cheio', OS_BANCADA_ID);
      const corpo = { ...base, ordem: { ...base.ordem, status: 'FINALIZADO', forma_pagamento: 'Cartão de Crédito' } };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(corpo),
      });
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'bancada');

    await expect(etapas(page).locator('[aria-current="step"]')).toHaveAccessibleName('Finalizado');
    await etapas(page).getByRole('button', { name: 'Pago / entregue', exact: true }).click();
    await expect(folha(page)).toBeVisible();
    for (const forma of FORMAS) {
      await expect(folha(page).getByRole('radio', { name: forma, exact: true })).not.toBeChecked();
    }
    await expect(folha(page).getByRole('button', { name: 'Confirmar pagamento' })).toBeDisabled();
  });

  test('etapas legíveis com aria-current; outras etapas mantêm a escrita direta com rótulo legível', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirBancada(page, tema);

    const botoes = etapas(page).getByRole('button');
    await expect(botoes).toHaveCount(5);
    for (let i = 0; i < ROTULOS.length; i++) await expect(botoes.nth(i)).toHaveAccessibleName(ROTULOS[i]);
    await expect(etapas(page).locator('[aria-current="step"]')).toHaveAccessibleName('Em execução');

    await etapas(page).getByRole('button', { name: 'Finalizado', exact: true }).click();
    await expect(folha(page)).toHaveCount(0);
    if (contextoDoProjeto(info).largura < 1024) {
      // no celular toda troca de etapa pede confirmação
      await folhaEtapa(page).getByRole('button', { name: 'Confirmar' }).click();
    } else {
      await expect(folhaEtapa(page)).toHaveCount(0);
    }
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toEqual({ status: 'FINALIZADO' });
    const aviso = page.getByRole('status').filter({ hasText: 'Finalizado' });
    await expect(aviso).toBeVisible();
    await expect(aviso).not.toContainText('FINALIZADO');
  });

  test('no celular, WhatsApp e Imprimir ficam numa barra acima da navegação', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrirBancada(page, tema);

    const barra = page.getByRole('region', { name: 'Ações da ordem de serviço' });
    await expect(barra).toBeVisible();
    const whats = barra.getByRole('link', { name: /WhatsApp/ });
    const imprimir = barra.getByRole('button', { name: /Imprimir/ });
    await expect(whats).toBeVisible();
    await expect(imprimir).toBeVisible();
    for (const alvo of [whats, imprimir]) expect((await alvo.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const nav = (await page.getByRole('navigation', { name: 'Navegação Rápida Mobile' }).boundingBox())!;
    const caixa = (await barra.boundingBox())!;
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(nav.y + 1);
    expect(caixa.y + caixa.height).toBeGreaterThanOrEqual(nav.y - 2);

    // o fim da página não fica escondido atrás da barra
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const ultimo = page.getByLabel('Relato do Problema / Diagnóstico');
    const c = (await ultimo.boundingBox())!;
    expect(c.y + c.height).toBeLessThanOrEqual(caixa.y);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });
});

test.describe('lista de ordens de serviço', () => {
  const lista = (page: Page) => page.getByRole('list', { name: 'Ordens de serviço' });

  test('todas as linhas e chips visíveis, sem rolagem lateral; nome da linha tem placa e etapa', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    await expect(page.getByRole('heading', { level: 1, name: /Ordens de Serviço/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova ordem de serviço' })).toHaveCount(1);

    const chips = page.getByRole('group', { name: 'Filtrar por etapa' }).getByRole('button');
    await expect(chips).toHaveCount(6);
    await expect(chips.first()).toHaveAccessibleName(/Todas.*12/);
    await expect(chips.nth(1)).toHaveAccessibleName(/Orçamento.*3/);
    // no celular a faixa rola na horizontal (teste próprio abaixo); aqui só o desktop
    for (const chip of info.project.use.viewport!.width >= 1024 ? await chips.all() : []) {
      await expect(chip).toBeVisible();
      const c = (await chip.boundingBox())!;
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    }

    const linhas = lista(page).getByRole('listitem');
    await expect(linhas).toHaveCount(ordens.length);
    for (const linha of await linhas.all()) {
      const abrir = linha.getByRole('button').first();
      await expect(abrir).toHaveAccessibleName(/Placa [A-Z0-9-]+/);
      await expect(abrir).toHaveAccessibleName(new RegExp(ROTULOS.join('|')));
    }
    await expect(lista(page)).not.toContainText('EXECUCAO');

    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('desktop: cada linha tem o botão de avançar etapa e WhatsApp com 44px', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura < 1024, 'só desktop');
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    const aprovar = lista(page).getByRole('button', { name: 'Aprovar → Execução' });
    await expect(aprovar).toHaveCount(3);
    await expect(aprovar.first()).toBeVisible();
    // OS pagas não têm próxima etapa
    const pagas = ordens.filter((o) => o.status === 'PAGO').length;
    const avancar = lista(page).getByRole('button', { name: /→ Execução|Concluir Serviço|Receber \/ Dar Baixa/ });
    await expect(avancar).toHaveCount(ordens.length - pagas);

    const whats = lista(page).getByRole('link', { name: /WhatsApp/ }).first();
    const w = (await whats.boundingBox())!;
    expect(w.height).toBeGreaterThanOrEqual(44);
    expect(w.width).toBeGreaterThanOrEqual(44);

    // Orçamento → Execução continua escrevendo direto, sem folha
    await aprovar.first().click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toEqual({ status: 'EXECUCAO' });
    await expect(folha(page)).toHaveCount(0);
  });

  test('celular: linhas sem botão de avançar etapa (toque acidental); tocar abre a bancada', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    await expect(lista(page).getByRole('listitem')).toHaveCount(ordens.length);
    await expect(lista(page).getByRole('button', { name: /→ Execução|Concluir Serviço|Receber \/ Dar Baixa/ })).toHaveCount(0);
    const whats = lista(page).getByRole('link', { name: /WhatsApp/ }).first();
    const w = (await whats.boundingBox())!;
    expect(w.height).toBeGreaterThanOrEqual(44);
    expect(w.width).toBeGreaterThanOrEqual(44);
    for (const linha of (await lista(page).getByRole('listitem').all()).slice(0, 4)) {
      expect((await linha.boundingBox())!.height).toBeLessThanOrEqual(80);
    }
    await lista(page).getByRole('listitem').first().getByRole('button').first().click();
    await expect(etapas(page)).toBeVisible();
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('"Receber / Dar Baixa" na lista também passa pela folha de pagamento', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura < 1024, 'o avanço pela lista é só no desktop');
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    // a primeira finalizada da lista (mais recente) tem total 1.740,00
    await lista(page).getByRole('button', { name: 'Receber / Dar Baixa' }).first().click();
    await expect(folha(page)).toBeVisible();
    await expect(folha(page)).toContainText(/R\$\s1\.740,00/);
    await expect(folha(page).getByRole('button', { name: 'Confirmar pagamento' })).toBeDisabled();
    await folha(page).getByRole('radio', { name: 'Cartão de Débito', exact: true }).check();
    await folha(page).getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toEqual({ status: 'PAGO', forma_pagamento: 'Cartão de Débito' });
    await expect(page.getByRole('status').filter({ hasText: 'Ordem marcada como paga' })).toBeVisible();
  });

  test('clicar na linha abre a bancada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');
    await lista(page).getByRole('listitem').nth(1).getByRole('button').first().click();
    await expect(etapas(page)).toBeVisible();
    exigirRedeCompleta(page);
  });
});

test.describe('busca da lista: debounce e respostas fora de ordem', () => {
  const lista = (page: Page) => page.getByRole('list', { name: 'Ordens de serviço' });
  const ehLeituraOS = (url: string) => /\/api\/v1\/os\/\?/.test(url);

  test('digitar 5 letras rápido gera uma só rodada de leituras', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    const leituras: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'GET' && ehLeituraOS(r.url())) leituras.push(r.url());
    });
    await page.getByRole('searchbox', { name: /Buscar Ordem de Serviço/ }).pressSequentially('QWE4R', { delay: 40 });
    await expect(lista(page).getByRole('listitem')).toHaveCount(2);
    await page.waitForTimeout(800);
    // 1 lista + 6 contagens, não 5 × 7
    expect(leituras.length).toBeLessThanOrEqual(7);
    expect(leituras.every((u) => new URL(u).searchParams.get('search') === 'QWE4R')).toBe(true);
  });

  test('resposta lenta de uma busca anterior não sobrescreve a mais nova', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await page.route('**/api/v1/os/?*', async (route) => {
      const busca = new URL(route.request().url()).searchParams.get('search');
      if (busca === 'Q') await new Promise((r) => setTimeout(r, 1500));
      await route.fallback();
    });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    const campo = page.getByRole('searchbox', { name: /Buscar Ordem de Serviço/ });
    await campo.pressSequentially('Q');
    await page.waitForTimeout(450); // dispara a busca "Q" (lenta)
    await campo.pressSequentially('WE');
    await expect(lista(page).getByRole('listitem')).toHaveCount(2);
    await page.waitForTimeout(1800); // a resposta de "Q" (12 linhas) chega depois
    await expect(lista(page).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('group', { name: 'Filtrar por etapa' }).getByRole('button').first()).toHaveAccessibleName(/Todas\s*2$/);
  });
});

test('linha mostra o defeito relatado (truncado, com title) e fica compacta no celular', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'ordens');
  const primeira = page.getByRole('list', { name: 'Ordens de serviço' }).getByRole('listitem').first();
  const defeito = primeira.getByText(ordens[0].descricao_problema!, { exact: true });
  // no desktop aparece; no celular ocupa só a sobra da linha (pode ficar sem espaço), mas está lá com o title
  if (largura >= 1024) await expect(defeito).toBeVisible();
  else await expect(defeito).toBeAttached();
  await expect(defeito).toHaveAttribute('title', ordens[0].descricao_problema!);
  const alt = (await primeira.boundingBox())!.height;
  expect(alt).toBeLessThanOrEqual(largura >= 1024 ? 96 : 80);
});

test('OS paga antiga sem forma de pagamento não destaca nenhuma forma', async ({ page }, info) => {
  const { tema } = contextoDoProjeto(info);
  await simularBackend(page, 'cheio');
  await page.route(`**/os/*/${OS_BANCADA_ID}/imprimir`, async (route) => {
    const base = dossie('cheio', OS_BANCADA_ID);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ...base, ordem: { ...base.ordem, status: 'PAGO', forma_pagamento: null } }),
    });
  });
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'bancada');
  for (const forma of FORMAS) {
    await expect(page.getByRole('button', { name: forma, exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
});

test.describe('celular: troca de etapa na bancada pede confirmação', () => {
  test('tocar numa etapa abre "Mover para…"; nada é escrito até Confirmar', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrirBancada(page, tema);
    const finalizado = etapas(page).getByRole('button', { name: 'Finalizado', exact: true });

    await finalizado.click();
    const f = page.getByRole('dialog', { name: 'Mover para Finalizado?' });
    await expect(f).toBeVisible();
    expect(await ultimaEscrita(page)).toBeUndefined();
    await f.getByRole('button', { name: 'Cancelar' }).click();
    await expect(f).toBeHidden();
    expect(await ultimaEscrita(page)).toBeUndefined();

    await finalizado.click();
    await expect(f).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(f).toBeHidden();
    expect(await ultimaEscrita(page)).toBeUndefined();
    await expect(etapas(page).locator('[aria-current="step"]')).toHaveAccessibleName('Em execução');

    await etapas(page).getByRole('button', { name: 'Orçamento', exact: true }).click();
    const o = page.getByRole('dialog', { name: 'Mover para Orçamento?' });
    await o.getByRole('button', { name: 'Confirmar' }).click();
    await expect(o).toBeHidden();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.corpo).toEqual({ status: 'ORCAMENTO' });
    await expect(page.getByRole('status').filter({ hasText: 'Etapa atualizada para Orçamento' })).toBeVisible();
  });
});

test.describe('bancada: etapa atual e confirmações pendentes', () => {
  test('tocar na etapa que já está ativa não abre confirmação nem grava', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirBancada(page, tema);
    const atual = etapas(page).locator('[aria-current="step"]');
    await expect(atual).toHaveAccessibleName('Em execução');
    await atual.click();
    await page.waitForTimeout(300);
    await expect(folhaEtapa(page)).toHaveCount(0);
    await expect(folha(page)).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('trocar de OS com "Mover para…" ou "Confirmar pagamento" aberto: a confirmação não reaparece na outra OS', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await abrirBancada(page, tema);
    const outra = ordens.find((o) => o.id !== OS_BANCADA_ID)!;
    const irPara = async (osId: string) => {
      await page.evaluate((id) => {
        window.history.pushState({}, '', `/?tab=os&osId=${id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, osId);
      await expect(page.getByText(`OS #${osId.slice(0, 8).toUpperCase()}`)).toBeVisible();
    };

    let destino = outra.id;
    if (largura < 1024) {
      await etapas(page).getByRole('button', { name: 'Finalizado', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Mover para Finalizado?' })).toBeVisible();
      await irPara(outra.id);
      await expect(folhaEtapa(page)).toHaveCount(0);
      destino = OS_BANCADA_ID;
    }

    await etapas(page).getByRole('button', { name: 'Pago / entregue', exact: true }).click();
    await expect(folha(page)).toBeVisible();
    await irPara(destino);
    await expect(folha(page)).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });
});

test('celular: chips de etapa numa linha só, com rolagem só dentro da faixa', async ({ page }, info) => {
  const { tema, largura } = contextoDoProjeto(info);
  test.skip(largura >= 1024, 'só celular');
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'ordens');

  const faixa = page.getByRole('group', { name: 'Filtrar por etapa' });
  const caixa = (await faixa.boundingBox())!;
  expect(caixa.height).toBeLessThanOrEqual(56);
  const chips = faixa.getByRole('button');
  await expect(chips.first()).toHaveAccessibleName(/Todas\s*12/);
  const ys = new Set<number>();
  for (const c of await chips.all()) {
    const b = (await c.boundingBox())!;
    ys.add(Math.round(b.y));
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(ys.size).toBe(1);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);

  const main = (await page.locator('#conteudo-principal').boundingBox())!;
  const primeira = (await page.getByRole('list', { name: 'Ordens de serviço' }).getByRole('listitem').first().boundingBox())!;
  expect(primeira.y - main.y).toBeLessThanOrEqual(320);

  // o chip ativo fica visível dentro da faixa
  await chips.last().click();
  await expect(chips.last()).toHaveAttribute('aria-pressed', 'true');
  const ult = (await chips.last().boundingBox())!;
  expect(ult.x + ult.width).toBeLessThanOrEqual(largura + 1);
  expect(ult.x).toBeGreaterThanOrEqual(-1);
});

test.describe('paginação da lista', () => {
  const TOTAL = 120;
  async function comMuitas(page: Page) {
    await page.route('**/api/v1/os/?*', async (route) => {
      const q = new URL(route.request().url()).searchParams;
      if (q.get('status') || q.get('search')) return route.fallback();
      const skip = Number(q.get('skip') || 0);
      const limit = Number(q.get('limit') || 50);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ items: limit === 1 ? ordens.slice(0, 1) : ordens, total: TOTAL, skip, limit }),
      });
    });
  }

  test('total maior que a página: controles visíveis, Próxima pede skip=50, Anterior desabilitado na 1ª', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await comMuitas(page);
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');

    const nav = page.getByRole('navigation', { name: 'Paginação de Ordens de Serviço' });
    await expect(nav).toBeVisible();
    await expect(nav).toContainText(/Mostrando 1–12 de 120/);
    const anterior = nav.getByRole('button', { name: 'Página anterior' });
    const proxima = nav.getByRole('button', { name: 'Próxima página' });
    await expect(anterior).toBeDisabled();
    await expect(proxima).toBeEnabled();
    for (const b of [anterior, proxima]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const pedido = page.waitForRequest((r) => /\/os\/\?/.test(r.url()) && new URL(r.url()).searchParams.get('skip') === '50' && new URL(r.url()).searchParams.get('limit') === '50');
    await proxima.click();
    await pedido;
    await expect(nav).toContainText(/Mostrando 51–62 de 120/);
    await expect(anterior).toBeEnabled();
  });

  test('total que cabe numa página: sem controles de paginação', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'ordens');
    await expect(page.getByRole('list', { name: 'Ordens de serviço' }).getByRole('listitem')).toHaveCount(ordens.length);
    await expect(page.getByRole('navigation', { name: 'Paginação de Ordens de Serviço' })).toHaveCount(0);
  });
});
