import { expect, test, type Page } from '@playwright/test';
import { API_URL, abrirTela, clientes, entrarComo, exigirRedeCompleta, simularBackend, veiculos, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto, exigirFocoNoPrimeiroCampo } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> };

/** Todas as escritas (POST/PUT) feitas à API simulada, na ordem. */
function gravarEscritas(page: Page): Escrita[] {
  const lista: Escrita[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(API_URL) || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) return;
    let corpo: Record<string, unknown> = {};
    try {
      corpo = r.postDataJSON() ?? {};
    } catch {
      /* sem corpo */
    }
    lista.push({ metodo: r.method(), caminho: new URL(r.url()).pathname.replace('/api/v1', ''), corpo });
  });
  return lista;
}

async function abrir(page: Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'clientes');
}

const lista = (page: Page) => page.getByRole('list', { name: 'Clientes' });
const linha = (page: Page, nome: string) => lista(page).getByRole('listitem').filter({ hasText: nome }).first();
const JOAO = clientes[0]; // tem 2 veículos: ABC1234 e DEF5G67
const veiculosDoJoao = veiculos.filter((v) => v.cliente_id === JOAO.id);

/** Botões visíveis (nome acessível não vazio) dentro de um elemento. */
const botoesVisiveis = async (el: ReturnType<Page['locator']>) => {
  let n = 0;
  for (const b of await el.getByRole('button').all()) if (await b.isVisible()) n++;
  return n;
};

test.describe('lista de clientes', () => {
  test('cabeçalho com contagem, busca visível, linhas sem excesso de botões e sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema);

    await expect(page.getByRole('heading', { level: 1, name: 'Clientes & veículos' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).locator('xpath=..')).toContainText(String(clientes.length));
    await expect(page.getByText(`${veiculos.length} veículos cadastrados`)).toBeVisible();
    await expect(page.getByRole('button', { name: /Novo cliente/ })).toHaveCount(1);
    await expect(page.getByRole('searchbox', { name: /Pesquisar por placa/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Clientes/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Placas/ })).toBeVisible();

    const linhas = lista(page).getByRole('listitem');
    await expect(linhas).toHaveCount(clientes.length);
    for (const l of await linhas.all()) {
      expect(await botoesVisiveis(l)).toBeLessThanOrEqual(4);
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('expandir mostra os veículos com PlateChip, separados por divisor, e recolhe de novo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const l = linha(page, JOAO.nome);
    const abrirLinha = l.getByRole('button', { name: new RegExp(JOAO.nome) }).first();
    await expect(abrirLinha).toHaveAttribute('aria-expanded', 'false');
    await abrirLinha.click();
    await expect(abrirLinha).toHaveAttribute('aria-expanded', 'true');

    const veics = l.getByRole('list', { name: `Veículos de ${JOAO.nome}` }).getByRole('listitem');
    await expect(veics).toHaveCount(veiculosDoJoao.length);
    await expect(veics.getByRole('img', { name: 'Placa ABC-1234' })).toBeVisible();
    await expect(veics.getByRole('img', { name: 'Placa DEF5G67' })).toBeVisible();
    for (const v of await veics.all()) expect(await botoesVisiveis(v)).toBeLessThanOrEqual(4);

    await abrirLinha.click();
    await expect(abrirLinha).toHaveAttribute('aria-expanded', 'false');
    await expect(l.getByRole('list', { name: `Veículos de ${JOAO.nome}` })).toHaveCount(0);
  });

  test('WhatsApp abre a conversa com o cliente', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const zap = linha(page, JOAO.nome).getByRole('link', { name: `WhatsApp de ${JOAO.nome}` });
    const href = (await zap.getAttribute('href'))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/55119700010/);
    expect(decodeURIComponent(href)).toContain('Olá João');
    await expect(zap).toHaveAttribute('target', '_blank');
  });

  test('busca por placa, telefone e nome; sem resultado mostra estado vazio com "Limpar"', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const busca = page.getByRole('searchbox', { name: /Pesquisar por placa/ });
    await busca.fill('qwe4r56');
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
    await expect(lista(page)).toContainText(clientes[2].nome);
    await busca.fill('zzzz');
    await expect(page.getByRole('heading', { name: 'Nenhum cliente encontrado' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar busca' }).click();
    await expect(lista(page).getByRole('listitem')).toHaveCount(clientes.length);
  });
});

test.describe('ações do cliente (menu)', () => {
  test('o menu tem editar ficha, adicionar veículo e histórico; Escape fecha', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const gatilho = linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` });
    await expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    await gatilho.click();
    await expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    const itens = page.getByRole('menu').getByRole('menuitem');
    await expect(itens).toHaveText([/Editar ficha/, /Adicionar veículo/, /Histórico de OS/]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('Tab fecha o menu e o foco segue adiante; escolher um item devolve o foco ao gatilho', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const gatilho = linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` });
    await gatilho.click();
    await expect(page.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement?.getAttribute('role') === 'menuitem')).toBe(false);

    await gatilho.click();
    await page.getByRole('menuitem', { name: /Editar ficha/ }).click();
    const d = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await expect(d).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await expect(gatilho).toBeFocused();
  });

  test('o menu reavalia o espaço (variável --barra-inferior-h) ao rolar/redimensionar com ele aberto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const gatilho = linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` });
    await gatilho.click();
    const menu = page.getByRole('menu');
    const acimaDoGatilho = async () => {
      const m = (await menu.boundingBox())!;
      const g = (await gatilho.boundingBox())!;
      return m.y + m.height <= g.y + 1;
    };
    const definirReserva = (v: string | null) =>
      page.evaluate((valor) => {
        const raiz = document.querySelector<HTMLElement>('[style*="--barra-inferior-h"]')!;
        if (valor === null) raiz.style.removeProperty('--barra-inferior-h');
        else raiz.style.setProperty('--barra-inferior-h', valor);
      }, v);
    expect(await acimaDoGatilho()).toBe(false);
    await definirReserva('900px'); // reserva real maior que o espaço abaixo
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await expect.poll(acimaDoGatilho).toBe(true);
    await definirReserva('0px');
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect.poll(acimaDoGatilho).toBe(false);
  });

  test('as folhas de formulário focam o primeiro campo ao abrir', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Editar ficha/ }).click();
    const ficha = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await exigirFocoNoPrimeiroCampo(ficha, /Nome Completo/);
    await page.keyboard.press('Escape');
    await expect(ficha).toBeHidden();
  });

  test('editar ficha envia PUT com os dados novos', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Editar ficha/ }).click();
    const d = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await expect(d).toBeVisible();
    await expect(d.getByLabel(/Nome Completo/)).toHaveValue(JOAO.nome);
    await d.getByLabel(/Nome Completo/).fill('João P. da Silva');
    await d.getByRole('button', { name: /Salvar ficha/i }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'João P. da Silva' })).toBeVisible();
    const put = escritas.find((e) => e.metodo === 'PUT' && e.caminho.includes(`/clientes/`));
    expect(put?.caminho).toContain(JOAO.id);
    expect(put?.corpo).toMatchObject({ nome: 'João P. da Silva', telefone: JOAO.telefone });
    expect(escritas.filter((e) => e.metodo === 'POST')).toHaveLength(0);
  });

  test('ficha exige nome e telefone (validação preservada)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    const d = page.getByRole('dialog', { name: /Novo cliente/ });
    await d.getByLabel(/Nome Completo/).fill('Só Nome');
    await d.getByLabel(/WhatsApp/).fill('   ');
    await d.getByRole('button', { name: /Salvar ficha/i }).click();
    await expect(d.getByRole('alert')).toContainText('Informe o nome e o WhatsApp/telefone do cliente.');
  });

  test('adicionar veículo abre a ficha já com um veículo em branco', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Adicionar veículo/ }).click();
    const d = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await d.getByRole('textbox', { name: /^Placa/ }).fill('ZZZ9Z99');
    await d.getByLabel(/^Modelo/).fill('Fusca');
    await d.getByRole('button', { name: /Salvar ficha/i }).click();
    await expect(d).toBeHidden();
    const post = escritas.find((e) => e.metodo === 'POST' && e.caminho.startsWith('/veiculos'));
    expect(post?.corpo).toMatchObject({ placa: 'ZZZ9Z99', modelo: 'Fusca', cliente_id: 'novo-id-0000' }); // o mock devolve esse id no PUT; o app usa o id da resposta
  });

  test('histórico do cliente lista as OS e leva à bancada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Histórico de OS/ }).click();
    const d = page.getByRole('dialog', { name: `Histórico de OS — ${JOAO.nome}` });
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Abrir OS' }).first()).toBeVisible();
    await expect(d.getByRole('img', { name: /Placa/ }).first()).toBeVisible();
    await d.getByRole('button', { name: 'Fechar' }).click();
    await expect(d).toBeHidden();
  });
});

test.describe('veículos do cliente', () => {
  async function expandir(page: Page) {
    const l = linha(page, JOAO.nome);
    await l.getByRole('button', { name: new RegExp(JOAO.nome) }).first().click();
    return l.getByRole('list', { name: `Veículos de ${JOAO.nome}` });
  }

  test('folhas de veículo e de OS rápida focam o primeiro campo ao abrir', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const veics = await expandir(page);
    await veics.getByRole('button', { name: 'Editar veículo ABC-1234' }).click();
    await exigirFocoNoPrimeiroCampo(page.getByRole('dialog', { name: /Editar Veículo — / }), page.locator('#edit-vei-placa'));
    await page.keyboard.press('Escape');

    await veics.getByRole('button', { name: 'Abrir OS para ABC-1234' }).click();
    await exigirFocoNoPrimeiroCampo(page.getByRole('dialog', { name: 'Abrir ordem de serviço' }), /KM atual na entrada/);
  });

  test('editar veículo: abre com os dados, consulta a placa e salva com PUT', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    const veics = await expandir(page);
    await veics.getByRole('button', { name: 'Editar veículo ABC-1234' }).click();
    const d = page.getByRole('dialog', { name: /Editar Veículo — ABC-1234/ });
    await expect(d.getByLabel(/^Modelo/)).toHaveValue('Gol 1.0');

    await d.getByLabel(/^Modelo/).fill('');
    await d.getByRole('button', { name: 'Buscar placa' }).click();
    await expect(d.getByLabel(/^Modelo/)).toHaveValue('Gol 1.0'); // vem da consulta de placa simulada
    await expect(d).toContainText('Dados preenchidos pela consulta de placa!');

    await d.getByLabel(/^KM atual/).fill('90000');
    await d.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(d).toBeHidden();
    const put = escritas.find((e) => e.metodo === 'PUT' && e.caminho.startsWith('/veiculos/'));
    expect(put?.corpo).toMatchObject({ placa: 'ABC1234', km_atual: 90000 });
  });

  test('histórico por placa mostra as OS do veículo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const veics = await expandir(page);
    await veics.getByRole('button', { name: 'Histórico do veículo ABC-1234' }).click();
    const d = page.getByRole('dialog', { name: 'Histórico do Veículo ABC-1234' });
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Abrir OS' }).first()).toBeVisible();
    await expect(d.getByRole('button', { name: /Abrir nova OS para ABC-1234/i })).toBeVisible();
  });

  test('+ OS abre a folha rápida e cria a OS para o veículo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    const veics = await expandir(page);
    await veics.getByRole('button', { name: 'Abrir OS para ABC-1234' }).click();
    const d = page.getByRole('dialog', { name: 'Abrir ordem de serviço' });
    await expect(d).toContainText('ABC-1234');
    await d.getByLabel(/Defeito Relatado/).fill('Barulho no motor');
    expect(escritas.filter((e) => e.metodo === 'POST')).toHaveLength(0); // nada escrito antes de confirmar
    await d.getByRole('button', { name: /Abrir bancada da OS/ }).click();
    await expect.poll(() => escritas.find((e) => e.metodo === 'POST' && e.caminho.startsWith('/os'))).toBeTruthy();
    const post = escritas.find((e) => e.metodo === 'POST' && e.caminho.startsWith('/os'))!;
    expect(post.corpo).toMatchObject({ veiculo_id: veiculosDoJoao[0].id, cliente_id: JOAO.id, descricao_problema: 'Barulho no motor' });
  });
});

test.describe('novo cliente com veículos', () => {
  test('cria o cliente e dois veículos; consulta de placa preenche o primeiro', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    const d = page.getByRole('dialog', { name: /Novo cliente/ });
    await expect(d).toBeVisible();
    await d.getByLabel(/Nome Completo/).fill('Cliente Teste');
    await d.getByLabel(/WhatsApp/).fill('(11) 91234-5678');

    await d.getByRole('textbox', { name: /^Placa/ }).first().fill('ABC1D23');
    await d.getByRole('button', { name: 'Buscar placa' }).first().click();
    await expect(d.getByLabel(/^Modelo/).first()).toHaveValue('Gol 1.0');
    await expect(d).toContainText('Dados do veículo preenchidos pela placa!');

    await d.getByRole('button', { name: /Adicionar outro veículo/i }).click();
    await d.getByRole('textbox', { name: /^Placa/ }).nth(1).fill('QQQ1A11');
    await d.getByLabel(/^Modelo/).nth(1).fill('Uno');
    await d.getByRole('button', { name: /Salvar ficha/i }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: 'Cliente Cliente Teste cadastrado com sucesso!' })).toBeVisible();

    const posts = escritas.filter((e) => e.metodo === 'POST');
    expect(posts.map((p) => p.caminho.replace(/\/$/, ''))).toEqual(['/clientes', '/veiculos', '/veiculos']);
    expect(posts[0].corpo).toMatchObject({ nome: 'Cliente Teste', telefone: '(11) 91234-5678' });
    expect(posts[1].corpo).toMatchObject({ placa: 'ABC1D23', modelo: 'Gol 1.0', cliente_id: 'novo-id-0000' });
    expect(posts[2].corpo).toMatchObject({ placa: 'QQQ1A11', modelo: 'Uno' });
  });

  test('Cancelar fecha sem escrever nada', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    const d = page.getByRole('dialog', { name: /Novo cliente/ });
    await d.getByLabel(/Nome Completo/).fill('Descartado');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click(); // há dados digitados: confirma o descarte
    await expect(d).toBeHidden();
    expect(escritas).toEqual([]);
  });
});

test.describe('sair das folhas de formulário', () => {
  test('Esc com dados digitados pede confirmação; Continuar mantém o valor; Descartar fecha sem escrever', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    const d = page.getByRole('dialog', { name: /Novo cliente/ });
    await d.getByLabel(/Nome Completo/).fill('Digitado');

    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByRole('alert')).toHaveCount(0);
    await expect(d.getByLabel(/Nome Completo/)).toHaveValue('Digitado');

    await d.getByRole('button', { name: 'Cancelar' }).click();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toBeHidden();
    expect(escritas).toEqual([]);
  });

  test('veículo em rascunho só com o chassi (vindo da busca da placa) também conta como dado digitado', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Adicionar veículo/ }).click();
    const d = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await d.getByRole('textbox', { name: /^Placa/ }).fill('ZZZ9Z99');
    await d.getByRole('button', { name: 'Buscar placa' }).click();
    await expect(d.getByLabel(/^Modelo/)).toHaveValue('Gol 1.0');
    // apaga tudo o que aparece; o chassi preenchido pela busca continua no rascunho
    for (const campo of [d.getByRole('textbox', { name: /^Placa/ }), d.getByLabel(/^Modelo/), d.getByLabel(/^Marca/), d.getByLabel(/^Cor/), d.getByLabel(/^Ano/)]) {
      await campo.fill('');
    }
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
  });

  test('formulário intacto fecha com Esc sem perguntar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    const d = page.getByRole('dialog', { name: /Novo cliente/ });
    await expect(d).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
  });

  test('editar veículo e ficha do cliente: Esc só pergunta se algo mudou', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await linha(page, JOAO.nome).getByRole('button', { name: `Mais ações de ${JOAO.nome}` }).click();
    await page.getByRole('menuitem', { name: /Editar ficha/ }).click();
    const d = page.getByRole('dialog', { name: `Ficha de ${JOAO.nome}` });
    await d.getByLabel(/Endereço/).fill('Outra rua');
    // "Editar carro" com a ficha alterada pergunta antes de sair
    await d.getByRole('button', { name: 'Editar carro' }).first().click();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Descartar' }).click();
    const v = page.getByRole('dialog', { name: /Editar Veículo — ABC-1234/ });
    await expect(v).toBeVisible();
    await page.keyboard.press('Escape'); // nada mudou no veículo
    await expect(v).toBeHidden();
  });
});

test.describe('visão por placas', () => {
  test('lista todos os veículos com PlateChip e dono; busca por placa; ações no menu', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('tab', { name: /Placas/ }).click();
    const l = page.getByRole('list', { name: 'Veículos' });
    await expect(l.getByRole('listitem')).toHaveCount(veiculos.length);
    for (const li of await l.getByRole('listitem').all()) {
      expect(await botoesVisiveis(li)).toBeLessThanOrEqual(4);
      await expect(li.getByRole('img', { name: /^Placa / })).toBeVisible();
    }
    await expect(l.getByRole('listitem').first()).toContainText(JOAO.nome);

    await page.getByRole('searchbox', { name: /Pesquisar por placa/ }).fill('KLM9');
    await expect(l.getByRole('listitem')).toHaveCount(1);
    const li = l.getByRole('listitem').first();
    await li.getByRole('button', { name: 'Mais ações do veículo KLM9N21' }).click();
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([/Histórico/, /Editar veículo/]);
    await page.getByRole('menuitem', { name: /Histórico/ }).click();
    await expect(page.getByRole('dialog', { name: 'Histórico do Veículo KLM9N21' })).toBeVisible();
  });
});

test.describe('paginação', () => {
  const TOTAL = 120;
  async function comMuitos(page: Page) {
    await page.route(/\/api\/v1\/clientes\/[^/?]+$/, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const muitos = Array.from({ length: TOTAL }, (_, i) => ({ ...clientes[i % clientes.length], id: `c-${i}`, nome: `Cliente ${String(i + 1).padStart(3, '0')}` }));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(muitos) });
    });
  }

  test('mais de uma página: "Mostrando A–B de TOTAL" e Anterior/Próxima de 44px', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await comMuitos(page);
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'clientes');
    await expect(lista(page).getByRole('listitem')).toHaveCount(50);

    const nav = page.getByRole('navigation', { name: 'Paginação de clientes' });
    await expect(nav).toBeVisible();
    await expect(nav).toContainText(/Mostrando 1–50 de 120/);
    const anterior = nav.getByRole('button', { name: 'Página anterior' });
    const proxima = nav.getByRole('button', { name: 'Próxima página' });
    await expect(anterior).toBeDisabled();
    for (const b of [anterior, proxima]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await proxima.click();
    await expect(nav).toContainText(/Mostrando 51–100 de 120/);
    await proxima.click();
    await expect(nav).toContainText(/Mostrando 101–120 de 120/);
    await expect(lista(page).getByRole('listitem')).toHaveCount(20);
    await expect(proxima).toBeDisabled();
  });

  test('uma página só: sem controles', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await expect(page.getByRole('navigation', { name: 'Paginação de clientes' })).toHaveCount(0);
  });
});

test('enquanto carrega, o cabeçalho não mostra contagem zerada', async ({ page }, info) => {
  const { tema } = contextoDoProjeto(info);
  await simularBackend(page, 'cheio');
  await page.route(/\/api\/v1\/clientes\/[^/?]+$/, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fallback();
  });
  await entrarComo(page, 'DONO', tema);
  await page.goto('/?tab=clientes');
  const h1 = page.getByRole('heading', { level: 1, name: 'Clientes & veículos' });
  await expect(h1).toBeVisible();
  await expect(h1.locator('xpath=..')).not.toContainText('0');
  await expect(page.getByText(/veículos cadastrados/)).toHaveCount(0);
  await expect(lista(page)).toBeVisible();
});

test.describe('estado vazio', () => {
  test('sem clientes: mensagem e uma única ação principal (a do cabeçalho)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema, 'vazio');
    await expect(page.getByRole('heading', { name: 'Nenhum cliente cadastrado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Novo cliente/ })).toHaveCount(1);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });
});

test.describe('celular', () => {
  test('todos os clientes numa lista vertical compacta, sem rolagem lateral e com alvos de 44px', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);

    const linhas = lista(page).getByRole('listitem');
    await expect(linhas).toHaveCount(clientes.length);
    const ys: number[] = [];
    for (const l of await linhas.all()) {
      await l.scrollIntoViewIfNeeded();
      const c = (await l.boundingBox())!;
      expect(c.height).toBeGreaterThanOrEqual(56);
      expect(c.height).toBeLessThanOrEqual(96);
      expect(c.x + c.width).toBeLessThanOrEqual(largura);
      ys.push(c.y);
      expect(await botoesVisiveis(l)).toBeLessThanOrEqual(4);
      for (const alvo of [...(await l.getByRole('button').all()), ...(await l.getByRole('link').all())]) {
        const b = (await alvo.boundingBox())!;
        expect(b.height, await alvo.getAttribute('aria-label') ?? 'alvo').toBeGreaterThanOrEqual(44);
      }
    }
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(clientes.length); // uma coluna, nenhuma lado a lado
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // controles principais também têm 44px
    for (const alvo of [page.getByRole('button', { name: /Novo cliente/ }), page.getByRole('searchbox', { name: /Pesquisar/ }), page.getByRole('tab', { name: /Placas/ })]) {
      expect((await alvo.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('veículo expandido: ações com 44px e sem rolagem lateral; nada é escrito ao tocar', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    const escritas = gravarEscritas(page);
    await abrir(page, tema);
    const l = linha(page, JOAO.nome);
    await l.getByRole('button', { name: new RegExp(JOAO.nome) }).first().click();
    const veics = l.getByRole('list', { name: `Veículos de ${JOAO.nome}` }).getByRole('listitem');
    for (const v of await veics.all()) {
      const c = (await v.boundingBox())!;
      expect(c.x + c.width).toBeLessThanOrEqual(largura);
      for (const b of await v.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(escritas).toEqual([]);
  });

  test('placas aparecem na linha do cliente mesmo recolhida', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await expect(linha(page, JOAO.nome)).toContainText('ABC-1234 · DEF5G67');
    for (const l of await lista(page).getByRole('listitem').all()) expect((await l.boundingBox())!.height).toBeLessThanOrEqual(96);
  });

  test('aba Placas: lista vertical com todos os veículos', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await page.getByRole('tab', { name: /Placas/ }).click();
    const itens = page.getByRole('list', { name: 'Veículos' }).getByRole('listitem');
    await expect(itens).toHaveCount(veiculos.length);
    for (const li of await itens.all()) expect((await li.boundingBox())!.height).toBeLessThanOrEqual(96);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
