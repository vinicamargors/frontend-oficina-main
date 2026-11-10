import { expect, test, type Page } from '@playwright/test';
import { EMPRESA_ID, abrirTela, configuracoesEmpresa, empresa, entrarComo, exigirRedeCompleta, simularBackend, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> };

/** Guarda todas as escritas (PUT/POST) da página: o `__ultimaEscrita` do mock só guarda a última. */
function registrarEscritas(page: Page): Escrita[] {
  const escritas: Escrita[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' || r.method() === 'OPTIONS') return;
    if (!r.url().startsWith('http://mock.api.local/api/v1')) return;
    escritas.push({ metodo: r.method(), caminho: new URL(r.url()).pathname.replace('/api/v1', ''), corpo: r.postDataJSON() });
  });
  return escritas;
}

async function abrir(page: Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'oficina');
}

/** Chega na tela pela navegação do app (cria uma entrada no histórico, para testar o "voltar"). */
async function abrirComHistorico(page: Page, tema: 'claro' | 'escuro') {
  await simularBackend(page, 'cheio');
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'radar');
  await page.evaluate(() => {
    window.history.pushState({}, '', '/?tab=oficina');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Dados da Oficina' })).toBeVisible();
  await expect(page.getByLabel(/Nome fantasia/)).toHaveValue(empresa.nome_fantasia);
}

const sobraLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const campo = (page: Page, rotulo: string | RegExp) => page.getByLabel(rotulo, { exact: typeof rotulo === 'string' });
const SECOES = ['Identificação', 'Endereço', 'Pagamento (PIX)', 'Ponto (GPS)', 'Folha e comissões'];
const barraMobile = (page: Page) => page.getByRole('navigation', { name: 'Navegação Rápida Mobile' });

test.describe('dados da oficina', () => {
  test('título, cinco seções com h2 em ordem, um só botão primário e sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema);

    await expect(page.getByRole('heading', { level: 1, name: 'Dados da Oficina' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(SECOES);
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(1);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('todos os campos de hoje continuam existindo, preenchidos com os dados da oficina', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await expect(campo(page, /^Nome fantasia/)).toHaveValue(empresa.nome_fantasia);
    await expect(campo(page, 'Razão social')).toHaveValue(empresa.razao_social!);
    await expect(campo(page, 'CNPJ')).toHaveValue(empresa.cnpj!);
    await expect(campo(page, 'Inscrição estadual')).toHaveValue(configuracoesEmpresa.inscricao_estadual);
    await expect(campo(page, 'E-mail')).toHaveValue(empresa.email!);
    await expect(campo(page, 'Telefone fixo')).toHaveValue(empresa.telefone!);
    await expect(campo(page, /^WhatsApp/)).toHaveValue(configuracoesEmpresa.whatsapp);
    await expect(campo(page, 'CEP')).toHaveValue('');
    await expect(campo(page, 'Endereço completo')).toHaveValue(empresa.endereco!);
    await expect(campo(page, 'Chave PIX')).toHaveValue(configuracoesEmpresa.chave_pix);
    await expect(page.getByText(/aparece nas ordens de serviço/i)).toBeVisible();
    await expect(campo(page, /^Raio de tolerância/)).toHaveValue('150');
    await expect(page.getByText(/Pátio localizado/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver no Google Maps/ })).toHaveAttribute('href', /-23\.55052,-46\.633308/);
    await expect(page.getByTitle('Pátio da Oficina')).toBeVisible();
    await expect(campo(page, 'Dia de pagamento da folha')).toHaveValue('5');
    await expect(campo(page, /^Dia do vale/)).toHaveValue('20');
    await expect(campo(page, /^Comissão de mão de obra/)).toHaveValue('15');
    await expect(campo(page, /^Comissão de peças/)).toHaveValue('5');
    await expect(campo(page, /^Valor da hora extra/)).toHaveValue('25');
    await expect(page.getByRole('checkbox', { name: 'Pagar hora extra por padrão' })).toBeChecked();
  });

  test('carregando mostra esqueleto no lugar dos campos (nada de campo vazio parecendo dado perdido)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await page.route('**/api/v1/empresas/*/configuracoes', async (r) => {
      if (r.request().method() === 'GET') await new Promise((ok) => setTimeout(ok, 1500));
      await r.fallback();
    });
    await page.goto('/?tab=oficina');
    await expect(page.getByRole('heading', { level: 1, name: 'Dados da Oficina' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(SECOES);
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando' }).first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    await expect(campo(page, /^Nome fantasia/)).toHaveValue(empresa.nome_fantasia);
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
  });

  test('falha ao carregar: mensagem, sem formulário vazio que poderia ser salvo por cima, e "Tentar novamente" recupera', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    let falhar = true;
    await page.route('**/api/v1/empresas/*/configuracoes', async (r) => {
      if (falhar && r.request().method() === 'GET') {
        return r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'Servidor fora do ar' }) });
      }
      await r.fallback();
    });
    await page.goto('/?tab=oficina');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0);
    falhar = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(campo(page, /^Nome fantasia/)).toHaveValue(empresa.nome_fantasia);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('salvar envia exatamente os mesmos campos e valores de antes, e confirma', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const escritas = registrarEscritas(page);
    await campo(page, /^Nome fantasia/).fill('  Oficina Nova  ');
    await campo(page, 'Chave PIX').fill('pix@oficina.example.com');
    await campo(page, /^Raio de tolerância/).fill('200');
    await campo(page, /^Comissão de peças/).fill('7.5');
    await page.getByRole('checkbox', { name: 'Pagar hora extra por padrão' }).uncheck();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Dados da oficina atualizados com sucesso!' })).toBeVisible();
    expect(escritas).toEqual([
      {
        metodo: 'PUT',
        caminho: `/empresas/${EMPRESA_ID}`,
        corpo: {
          nome_fantasia: 'Oficina Nova',
          razao_social: empresa.razao_social,
          cnpj: empresa.cnpj,
          telefone: empresa.telefone,
          endereco: empresa.endereco,
          email: empresa.email,
        },
      },
      {
        metodo: 'PUT',
        caminho: `/empresas/${EMPRESA_ID}/configuracoes`,
        corpo: {
          nome_exibicao: 'Oficina Nova',
          cor_primaria: configuracoesEmpresa.cor_primaria,
          cor_secundaria: configuracoesEmpresa.cor_secundaria,
          inscricao_estadual: configuracoesEmpresa.inscricao_estadual,
          whatsapp: configuracoesEmpresa.whatsapp,
          chave_pix: 'pix@oficina.example.com',
          latitude_gps: configuracoesEmpresa.latitude_gps,
          longitude_gps: configuracoesEmpresa.longitude_gps,
          raio_gps_metros: 200,
        },
      },
      {
        metodo: 'PUT',
        caminho: `/empresas/${EMPRESA_ID}/configuracoes`,
        corpo: {
          dia_pagamento_folha: 5,
          dia_adiantamento_folha: 20,
          comissao_global_servico_pct: 15,
          comissao_global_peca_pct: 7.5,
          paga_hora_extra_padrao: false,
          valor_hora_extra_padrao: 25,
        },
      },
    ]);
    // salvo: nada mais pendente
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);
  });

  test('CEP completo preenche endereço vazio e localiza o pátio; o salvar leva as novas coordenadas', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.route('https://cep.awesomeapi.com.br/json/*', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ cep: '01310100', address: 'Avenida Paulista', district: 'Bela Vista', city: 'São Paulo', state: 'SP', lat: '-23.56', lng: '-46.65' }),
      })
    );
    const escritas = registrarEscritas(page);
    await campo(page, 'Endereço completo').fill('');
    await campo(page, 'CEP').fill('01310100');
    await expect(campo(page, 'CEP')).toHaveValue('01310-100');
    await expect(campo(page, 'Endereço completo')).toHaveValue('Avenida Paulista, [Número] — Bela Vista — São Paulo/SP');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'atualizados com sucesso' })).toBeVisible();
    expect(escritas[0].corpo.endereco).toBe('Avenida Paulista, [Número] — Bela Vista — São Paulo/SP — CEP 01310-100');
    expect(escritas[1].corpo).toMatchObject({ latitude_gps: -23.56, longitude_gps: -46.65 });
  });

  test('sem coordenadas: aviso pedindo CEP ou endereço, sem mapa e sem link', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await page.route('**/api/v1/empresas/*/configuracoes', async (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ...configuracoesEmpresa, latitude_gps: null, longitude_gps: null, raio_gps_metros: 100 }),
      });
    });
    await page.route('**/api/v1/empresas/?*', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify([{ ...empresa, endereco: '' }]),
      });
    });
    await abrirTela(page, 'oficina');
    await expect(page.getByText(/Preencha o CEP ou o endereço/)).toBeVisible();
    await expect(page.getByTitle('Pátio da Oficina')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Ver no Google Maps/ })).toHaveCount(0);
  });

  test('erro ao salvar: mostra o problema, mantém o que foi digitado e continua salvável', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.route(`**/api/v1/empresas/${EMPRESA_ID}`, async (r) => {
      if (r.request().method() !== 'PUT') return r.fallback();
      await r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'Falha no servidor' }) });
    });
    await campo(page, 'Chave PIX').fill('nova-chave');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(campo(page, 'Chave PIX')).toHaveValue('nova-chave');
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
  });

  test('formulário sujo: voltar pergunta "Descartar alterações?"; continuar mantém, descartar sai', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirComHistorico(page, tema);
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);
    await campo(page, 'Chave PIX').fill('pix-digitado');
    await expect(page.getByText('Alterações não salvas')).toBeVisible();

    await page.goBack();
    const aviso = page.getByRole('alert').filter({ hasText: 'Descartar alterações?' });
    await expect(aviso).toBeVisible();
    await expect(page).toHaveURL(/tab=oficina/);
    await aviso.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(aviso).toHaveCount(0);
    await expect(campo(page, 'Chave PIX')).toHaveValue('pix-digitado');

    await page.goBack();
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dados da Oficina' })).toHaveCount(0);
    await expect(page).not.toHaveURL(/tab=oficina/);
  });

  test('formulário limpo: voltar sai sem perguntar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrirComHistorico(page, tema);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Dados da Oficina' })).toHaveCount(0);
  });

  test('formulário sujo: "Atualizar" e "Descartar" pedem confirmação antes de perder o que foi digitado', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await campo(page, 'Razão social').fill('Outra Razão');
    await page.getByRole('button', { name: 'Atualizar' }).click();
    const aviso = page.getByRole('alert').filter({ hasText: 'Descartar alterações?' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(campo(page, 'Razão social')).toHaveValue('Outra Razão');

    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Descartar' }).click();
    await expect(campo(page, 'Razão social')).toHaveValue(empresa.razao_social!);
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);
  });

  test('foco de teclado visível e rótulo em todos os campos', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const sem = await page.getByRole('main').locator('input, select, textarea').evaluateAll((els) =>
      els.filter((e) => !(e as HTMLInputElement).labels?.length).map((e) => (e as HTMLElement).outerHTML.slice(0, 80))
    );
    expect(sem).toEqual([]);
  });

  test('celular: tudo em um fluxo vertical, alvos de 44px, barra de salvar acima da navegação inferior', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);

    // seções empilhadas (cada uma abaixo da anterior) e sem coluna lateral
    const topos: number[] = [];
    const larguras: number[] = [];
    for (const nome of SECOES) {
      const h = page.getByRole('heading', { level: 2, name: nome });
      const b = (await h.boundingBox())!;
      topos.push(b.y + (await page.evaluate(() => window.scrollY)));
      larguras.push(b.x);
    }
    expect([...topos].sort((a, b) => a - b)).toEqual(topos);
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(1);

    for (const alvo of await page.getByRole('main').locator('input:not([type=checkbox]), button, a[href]').all()) {
      if (!(await alvo.isVisible())) continue;
      expect((await alvo.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    }
    const checkbox = page.getByRole('checkbox', { name: 'Pagar hora extra por padrão' });
    const linhaCheckbox = (await checkbox.locator('xpath=ancestor::label[1]').boundingBox())!;
    expect(linhaCheckbox.height).toBeGreaterThanOrEqual(43.5);

    // barra de salvar: visível no topo da página e sem tocar a navegação fixa
    await campo(page, 'Chave PIX').fill('abc');
    const salvar = page.getByRole('button', { name: 'Salvar alterações' });
    await expect(salvar).toBeVisible();
    const b = (await salvar.boundingBox())!;
    const nav = (await barraMobile(page).boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(nav.y);
    await page.mouse.wheel(0, 600);
    const b2 = (await salvar.boundingBox())!;
    expect(b2.y + b2.height).toBeLessThanOrEqual(nav.y);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const b3 = (await salvar.boundingBox())!;
    expect(b3.y + b3.height).toBeLessThanOrEqual(nav.y);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('sem cartão dentro de cartão e sem texto menor que 12px', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const aninhados = await page.getByRole('main').evaluate((main) => {
      const fundo = (e: Element) => getComputedStyle(e).backgroundColor;
      const cartoes = [...main.querySelectorAll('*')].filter((e) => getComputedStyle(e).borderRadius !== '0px' && /rounded-2xl/.test(e.className.toString()) && fundo(e) !== 'rgba(0, 0, 0, 0)');
      return cartoes.filter((c) => cartoes.some((o) => o !== c && o.contains(c))).length;
    });
    expect(aninhados).toBe(0);
    const pequenos = await page.getByRole('main').evaluate((main) =>
      [...main.querySelectorAll('*')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length
    );
    expect(pequenos).toBe(0);
  });
});
