import { expect, test, type Page, type Route } from '@playwright/test';
import type { StatusOS } from '../src/types';
import { EMPRESA_ID, abrirTela, entrarComo, exigirRedeCompleta, listaOS, ordens, perfilDoCargo, simularBackend } from './mocks';
import { contextoDoProjeto } from './contexto';
import { formatarPlaca } from '../src/components/ui/PlateChip';

// Fixtures `cheio`, período padrão de 7 dias: ORC 2, AGP 2, EXE 2, FIN 1.
// A ordem mais nova (0 dias) está em Orçamento; é ela que os testes movem.
const OS = ordens[0];
const PLACA = formatarPlaca(OS.veiculos!.placa!);
const OUTRA = ordens[3]; // outro orçamento (3 dias)
const ROTULO: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  AGUARDANDO_PECA: 'Aguardando peça',
  EXECUCAO: 'Em execução',
  FINALIZADO: 'Finalizado',
};
const CHAVE_DICA = 'mecanify_radar_dica_arrastar';

interface Escrita {
  metodo: string;
  caminho: string;
  corpo: unknown;
}

interface Opcoes {
  /** Responde a gravação com 500. */
  falhar?: boolean;
  /** Segura a resposta da gravação até `liberar()`. */
  segurar?: boolean;
  cargo?: 'DONO' | 'MECANICO' | 'VISITANTE';
}

/**
 * Backend simulado com memória: a gravação de etapa (`PUT /os/{empresa}/{id}`) fica registrada e a próxima
 * leitura de `/os/` já traz a ordem na etapa nova (o quadro recarregado é a fonte da verdade).
 */
async function preparar(page: Page, tema: 'claro' | 'escuro', opcoes: Opcoes = {}) {
  const escritas: Escrita[] = [];
  const statusAtual: Record<string, StatusOS> = {};
  let liberar: () => void = () => {};
  const segurando = new Promise<void>((r) => (liberar = r));
  const leituras = { os: 0, dashboard: 0 };

  await simularBackend(page, 'cheio');
  const json = (route: Route, corpo: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) });

  await page.route(/\/api\/v1\/os\/\?/, (route) => json(route, listaOS('cheio', new URL(route.request().url()).searchParams, statusAtual)));
  await page.route(/\/api\/v1\/os\/[^/?]+\/[^/?]+$/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    if (req.method() === 'GET') return route.fallback();
    const caminho = new URL(req.url()).pathname.replace(/^\/api\/v1/, '');
    const corpo = req.postDataJSON();
    escritas.push({ metodo: req.method(), caminho, corpo });
    if (opcoes.segurar) await segurando;
    if (opcoes.falhar) return json(route, { detail: 'psycopg2.OperationalError: connection refused' }, 500);
    statusAtual[caminho.split('/').pop()!] = (corpo as { status: StatusOS }).status;
    return json(route, { id: caminho.split('/').pop(), ...(corpo as object) });
  });
  if (opcoes.cargo === 'VISITANTE') {
    await page.route(/\/api\/v1\/usuarios\/me$/, (route) => json(route, { ...perfilDoCargo('MECANICO'), cargo: 'VISITANTE' }));
  }
  page.on('request', (r) => {
    if (/\/os\/\?/.test(r.url())) leituras.os++;
    if (/\/dashboards\//.test(r.url())) leituras.dashboard++;
  });
  await entrarComo(page, opcoes.cargo === 'MECANICO' || opcoes.cargo === 'VISITANTE' ? 'MECANICO' : 'DONO', tema);
  await abrirTela(page, 'radar');
  await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'false');
  return { escritas, liberar: () => liberar(), leituras };
}

/** Quadro visível na largura atual: colunas no desktop, lista empilhada no celular. */
const area = (page: Page, largura: number) => page.getByTestId(largura >= 1024 ? 'quadro-patio' : 'patio-lista');
const coluna = (page: Page, largura: number, status: string) => area(page, largura).getByRole('region', { name: ROTULO[status], exact: true });
const cardDe = (page: Page, largura: number, status: string, id = OS.id) => coluna(page, largura, status).locator(`[data-os-id="${id}"]`);
const contagem = (page: Page, largura: number, status: string) => coluna(page, largura, status).getByTestId('contagem-etapa');
const folhaMover = (page: Page, para: string) => page.getByRole('dialog', { name: `Mover ${PLACA} para ${ROTULO[para]}?` });
const gatilhoMenu = (page: Page, largura: number, status: string, placa = PLACA) =>
  coluna(page, largura, status).getByRole('button', { name: `Ações da ordem ${placa}` });

async function esperarQuieto(page: Page) {
  await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(300);
}

/** Começa um arrasto sem soltar (o `dragTo` é atômico): dragstart no card e dragenter/dragover na coluna. */
async function arrastarSemSoltar(page: Page, id: string, sobre: StatusOS) {
  await page.evaluate(
    ({ id, sobre }) => {
      const quadro = document.querySelector('[data-testid="quadro-patio"]')!;
      const card = quadro.querySelector(`[data-os-id="${id}"]`)!;
      const coluna = quadro.querySelector(`[data-etapa="${sobre}"]`)!;
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      coluna.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
      coluna.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { id, sobre }
  );
}

test.describe('radar: arrastar o card para mudar a etapa (desktop)', () => {
  test.beforeEach(({}, info) => {
    test.skip(contextoDoProjeto(info).largura < 1024, 'arrastar é só no quadro do desktop');
  });

  test('soltar em outra coluna abre a confirmação com de → para, sem gravar; Confirmar grava {status} e recarrega uma vez', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, leituras } = await preparar(page, tema);
    await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveAttribute('draggable', 'true');

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'EXECUCAO'));
    const folha = folhaMover(page, 'EXECUCAO');
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId('mover-de')).toHaveText('Orçamento');
    await expect(folha.getByTestId('mover-para')).toHaveText('Em execução');
    await expect(folha).toContainText('Para marcar como pago, abra a ordem');
    // o foco vai para o título (nenhuma opção pré-escolhida)
    await expect(folha.getByRole('heading')).toBeFocused();
    expect(escritas).toEqual([]);
    // nada mudou no quadro antes de confirmar
    await expect(cardDe(page, largura, 'ORCAMENTO')).toBeVisible();

    leituras.os = 0;
    leituras.dashboard = 0;
    await folha.getByRole('button', { name: 'Confirmar' }).click();
    await expect(folha).toBeHidden();
    expect(escritas).toEqual([{ metodo: 'PUT', caminho: `/os/${EMPRESA_ID}/${OS.id}`, corpo: { status: 'EXECUCAO' } }]);
    await expect(cardDe(page, largura, 'EXECUCAO')).toBeVisible();
    await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveCount(0);
    await expect(contagem(page, largura, 'ORCAMENTO')).toHaveText('1');
    await expect(contagem(page, largura, 'EXECUCAO')).toHaveText('3');
    await expect(page.getByRole('status').filter({ hasText: `${PLACA} movida para Em execução` })).toHaveCount(1);
    await esperarQuieto(page);
    // exatamente um recarregamento: as 9 leituras de sempre (8 de ordens + estoque)
    expect(leituras).toEqual({ os: 8, dashboard: 1 });
    // depois do recarregamento o quadro (fonte da verdade) mantém o card na etapa nova
    await expect(cardDe(page, largura, 'EXECUCAO')).toBeVisible();
    expect(escritas).toHaveLength(1);
    exigirRedeCompleta(page);
  });

  test('Cancelar, Esc e clique no fundo não gravam nada e o card fica onde estava', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, leituras } = await preparar(page, tema);
    leituras.os = 0;

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'FINALIZADO'));
    await folhaMover(page, 'FINALIZADO').getByRole('button', { name: 'Cancelar' }).click();
    await expect(folhaMover(page, 'FINALIZADO')).toBeHidden();

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'AGUARDANDO_PECA'));
    await expect(folhaMover(page, 'AGUARDANDO_PECA')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(folhaMover(page, 'AGUARDANDO_PECA')).toBeHidden();

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'EXECUCAO'));
    await expect(folhaMover(page, 'EXECUCAO')).toBeVisible();
    await page.mouse.click(8, 8); // fundo do <dialog>
    await expect(folhaMover(page, 'EXECUCAO')).toBeHidden();

    await page.waitForTimeout(300);
    expect(escritas).toEqual([]);
    expect(leituras.os).toBe(0);
    await expect(cardDe(page, largura, 'ORCAMENTO')).toBeVisible();
    await expect(contagem(page, largura, 'ORCAMENTO')).toHaveText('2');
    await expect(contagem(page, largura, 'FINALIZADO')).toHaveText('1');
  });

  test('soltar na mesma coluna ou fora das colunas não abre nada; a coluna de origem não acende', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'ORCAMENTO'), { targetPosition: { x: 40, y: 10 } });
    await cardDe(page, largura, 'ORCAMENTO').dragTo(page.getByRole('group', { name: 'Resumo do pátio' }));
    await page.waitForTimeout(300);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(escritas).toEqual([]);

    // durante o arrasto: as outras colunas aceitam (realce suave); a de baixo do ponteiro realça mais; a de origem, nada
    await arrastarSemSoltar(page, OS.id, 'ORCAMENTO');
    await expect(coluna(page, largura, 'ORCAMENTO')).not.toHaveAttribute('data-alvo', /.+/);
    await expect(coluna(page, largura, 'EXECUCAO')).toHaveAttribute('data-alvo', 'valido');
    await arrastarSemSoltar(page, OS.id, 'EXECUCAO');
    await expect(coluna(page, largura, 'EXECUCAO')).toHaveAttribute('data-alvo', 'sobre');
    await expect(coluna(page, largura, 'FINALIZADO')).toHaveAttribute('data-alvo', 'valido');
    await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveAttribute('data-arrastando', 'true');
    // fim do arrasto sem soltar: tudo volta ao normal
    await cardDe(page, largura, 'ORCAMENTO').dispatchEvent('dragend');
    await expect(coluna(page, largura, 'EXECUCAO')).not.toHaveAttribute('data-alvo', /.+/);
    await expect(cardDe(page, largura, 'ORCAMENTO')).not.toHaveAttribute('data-arrastando', /.+/);
  });

  test('coluna vazia tem área para soltar e recebe o card', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);
    // 7 dias: Finalizado tem só a ordem de 5 dias; ela vai para Orçamento e a coluna fica vazia
    const fin = ordens[5];
    await coluna(page, largura, 'FINALIZADO').locator(`[data-os-id="${fin.id}"]`).dragTo(coluna(page, largura, 'ORCAMENTO'));
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await esperarQuieto(page);
    await expect(contagem(page, largura, 'FINALIZADO')).toHaveText('0');
    const vazia = coluna(page, largura, 'FINALIZADO').getByTestId('area-soltar');
    expect((await vazia.boundingBox())!.height).toBeGreaterThanOrEqual(96);

    await cardDe(page, largura, 'ORCAMENTO').dragTo(vazia);
    await folhaMover(page, 'FINALIZADO').getByRole('button', { name: 'Confirmar' }).click();
    await expect(cardDe(page, largura, 'FINALIZADO')).toBeVisible();
    expect(escritas.map((e) => e.corpo)).toEqual([{ status: 'ORCAMENTO' }, { status: 'FINALIZADO' }]);
  });

  test('falha ao gravar: o card volta para a coluna de origem e aparece um aviso amigável (role=alert)', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, leituras } = await preparar(page, tema, { falhar: true });
    leituras.os = 0;

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'EXECUCAO'));
    await folhaMover(page, 'EXECUCAO').getByRole('button', { name: 'Confirmar' }).click();
    const aviso = page.getByRole('alert').filter({ hasText: `Não foi possível mover ${PLACA}` });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('continua em Orçamento');
    await expect(page.getByText(/psycopg2|connection refused/)).toHaveCount(0);
    await expect(folhaMover(page, 'EXECUCAO')).toBeHidden();
    await expect(cardDe(page, largura, 'ORCAMENTO')).toBeVisible();
    await expect(cardDe(page, largura, 'EXECUCAO')).toHaveCount(0);
    await expect(contagem(page, largura, 'ORCAMENTO')).toHaveText('2');
    await expect(contagem(page, largura, 'EXECUCAO')).toHaveText('2');
    await expect(page.getByRole('status').filter({ hasText: 'movida para' })).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(escritas).toHaveLength(1);
    expect(leituras.os).toBe(0); // sem recarregar
    // a dica continua (nenhuma mudança deu certo)
    await expect(page.getByText('Arraste um card para outra etapa para mudar o status')).toBeVisible();
  });

  test('uma mudança por vez: Confirmar fica desabilitado e nada mais arrasta enquanto grava', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, liberar } = await preparar(page, tema, { segurar: true });

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'EXECUCAO'));
    const folha = folhaMover(page, 'EXECUCAO');
    const confirmar = folha.getByRole('button', { name: 'Confirmar' });
    await confirmar.click();
    await expect(confirmar).toBeDisabled();
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(folha.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    // movimento otimista já visível atrás da folha
    await expect(cardDe(page, largura, 'EXECUCAO')).toBeAttached();
    await confirmar.click({ force: true });
    await confirmar.dblclick({ force: true });
    // Esc (nem um segundo Esc) não "cancela" nem fecha a folha de uma gravação já enviada
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(folha).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('dialog')?.open)).toBe(true);
    // nenhum card arrasta enquanto grava
    const outro = coluna(page, largura, 'ORCAMENTO').locator(`[data-os-id="${OUTRA.id}"]`);
    await expect(outro).toHaveAttribute('draggable', 'false');
    expect(escritas).toHaveLength(1);

    liberar();
    await expect(folha).toBeHidden();
    await esperarQuieto(page);
    expect(escritas).toHaveLength(1);
    await expect(outro).toHaveAttribute('draggable', 'true');
  });

  test('dica de arrastar: aparece até a primeira mudança que dá certo e é lembrada; cards descrevem o menu', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await preparar(page, tema);
    const dica = page.getByText('Arraste um card para outra etapa para mudar o status');
    await expect(dica).toBeVisible();
    const abrir = cardDe(page, largura, 'ORCAMENTO').getByRole('button', { name: new RegExp(`^Placa ${PLACA}`) });
    await expect(abrir).toHaveAccessibleDescription('Use o menu … para mover para outra etapa');

    await cardDe(page, largura, 'ORCAMENTO').dragTo(coluna(page, largura, 'AGUARDANDO_PECA'));
    await folhaMover(page, 'AGUARDANDO_PECA').getByRole('button', { name: 'Confirmar' }).click();
    await expect(dica).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), CHAVE_DICA)).toBe('1');
    await page.reload();
    await expect(page.getByTestId('quadro-patio')).toBeVisible();
    await expect(dica).toHaveCount(0);
  });
});

test.describe('radar: menu "…" do card (todas as larguras)', () => {
  test('itens: Abrir ordem e Mover para cada outra etapa; teclado (Enter, setas, Enter) abre a mesma confirmação e grava {status}', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);
    const gatilho = gatilhoMenu(page, largura, 'ORCAMENTO');
    await expect(gatilho).toBeVisible();
    await expect(gatilho).toHaveAttribute('aria-haspopup', 'menu');
    await expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    const caixa = (await gatilho.boundingBox())!;
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);

    await gatilho.focus();
    await page.keyboard.press('Enter');
    await expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu', { name: `Ações da ordem ${PLACA}` });
    await expect(menu.getByRole('menuitem')).toHaveText(['Abrir ordem', 'Mover para Aguardando peça', 'Mover para Em execução', 'Mover para Finalizado']);
    await expect(menu.getByRole('menuitem', { name: 'Abrir ordem' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Mover para Em execução' })).toBeFocused();
    await page.keyboard.press('Enter');

    const folha = folhaMover(page, 'EXECUCAO');
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId('mover-de')).toHaveText('Orçamento');
    expect(escritas).toEqual([]);
    await page.keyboard.press('Tab'); // título -> Cancelar
    await page.keyboard.press('Tab'); // -> Confirmar
    await expect(folha.getByRole('button', { name: 'Confirmar' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(folha).toBeHidden();
    expect(escritas).toEqual([{ metodo: 'PUT', caminho: `/os/${EMPRESA_ID}/${OS.id}`, corpo: { status: 'EXECUCAO' } }]);
    await expect(cardDe(page, largura, 'EXECUCAO')).toBeVisible();
    await esperarQuieto(page);
    // o foco segue o card para a etapa nova (o teclado não se perde)
    await expect(gatilhoMenu(page, largura, 'EXECUCAO')).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: `${PLACA} movida para Em execução` })).toHaveCount(1);
    exigirRedeCompleta(page);
  });

  test('Esc fecha o menu e devolve o foco; Tab fecha; Abrir ordem abre a OS', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);
    const gatilho = gatilhoMenu(page, largura, 'ORCAMENTO');
    await gatilho.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(gatilho).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await gatilho.click();
    await page.getByRole('menuitem', { name: 'Abrir ordem' }).click();
    await expect(page).toHaveURL(new RegExp(`osId=${OS.id}`));
    expect(escritas).toEqual([]);
  });

  test('no celular não há arrasto: o "…" é o caminho; linha com no máximo 3 controles', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    const { escritas } = await preparar(page, tema);
    const linha = cardDe(page, largura, 'ORCAMENTO');
    await expect(linha).not.toHaveAttribute('draggable', 'true');
    await expect(linha.locator('button, a')).toHaveCount(3);
    await expect(page.getByText('Arraste um card para outra etapa para mudar o status')).toBeHidden();

    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await page.getByRole('menuitem', { name: 'Mover para Aguardando peça' }).click();
    const folha = folhaMover(page, 'AGUARDANDO_PECA');
    await expect(folha).toBeVisible();
    await expect(folha.getByTestId('mover-para')).toHaveText('Aguardando peça');
    await folha.getByRole('button', { name: 'Confirmar' }).click();
    await expect(folha).toBeHidden();
    expect(escritas).toEqual([{ metodo: 'PUT', caminho: `/os/${EMPRESA_ID}/${OS.id}`, corpo: { status: 'AGUARDANDO_PECA' } }]);
    await expect(cardDe(page, largura, 'AGUARDANDO_PECA')).toBeVisible();
    await expect(contagem(page, largura, 'AGUARDANDO_PECA')).toHaveText('3');
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test('pelo menu, um duplo clique em Confirmar grava uma vez só', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, liberar } = await preparar(page, tema, { segurar: true });
    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await page.getByRole('menuitem', { name: 'Mover para Finalizado' }).click();
    const confirmar = folhaMover(page, 'FINALIZADO').getByRole('button', { name: 'Confirmar' });
    await confirmar.dblclick();
    await expect(confirmar).toBeDisabled();
    await page.waitForTimeout(200);
    expect(escritas).toHaveLength(1);
    liberar();
    await expect(folhaMover(page, 'FINALIZADO')).toBeHidden();
    await esperarQuieto(page);
    expect(escritas).toHaveLength(1);
    await expect(cardDe(page, largura, 'FINALIZADO')).toBeVisible();
  });
});

test.describe('radar: mudança de etapa e recarregamento do quadro', () => {
  const botaoPeriodo = (page: Page) => page.getByRole('button', { name: /^(Últimos|Período) / });

  /** Segura as leituras do quadro (as 9) até `soltar()`. */
  async function segurarLeituras(page: Page) {
    let soltar: () => void = () => {};
    const portao = new Promise<void>((r) => (soltar = r));
    const segurar = async (route: Route) => {
      await portao;
      await route.fallback();
    };
    await page.route(/\/api\/v1\/os\/\?/, segurar);
    await page.route(/\/api\/v1\/dashboards\//, segurar);
    return {
      soltar: async () => {
        soltar();
        await page.unroute(/\/api\/v1\/os\/\?/, segurar);
        await page.unroute(/\/api\/v1\/dashboards\//, segurar);
      },
    };
  }

  test('enquanto o quadro recarrega, o teclado não consegue pedir mudança: "Mover para" desabilitado com o motivo, sem folha, sem gravar', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);
    const leituras = await segurarLeituras(page);
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByTestId('radar-conteudo')).toHaveAttribute('aria-busy', 'true');

    const gatilho = gatilhoMenu(page, largura, 'ORCAMENTO');
    await gatilho.focus();
    await page.keyboard.press('Enter');
    const item = page.getByRole('menuitem', { name: /^Mover para Em execução/ });
    await expect(item).toBeDisabled();
    await expect(item).toHaveAttribute('title', 'Aguarde a atualização do quadro');
    await expect(page.getByRole('menuitem', { name: 'Abrir ordem' })).toBeFocused();
    await page.keyboard.press('ArrowDown'); // os itens inativos ficam fora das setas
    await expect(page.getByRole('menuitem', { name: 'Abrir ordem' })).toBeFocused();
    await item.click({ force: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (largura >= 1024) await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveAttribute('draggable', 'false');
    expect(escritas).toEqual([]);

    await leituras.soltar();
    await esperarQuieto(page);
    await gatilho.click();
    await expect(page.getByRole('menuitem', { name: 'Mover para Em execução' })).toBeEnabled();
    if (largura >= 1024) await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveAttribute('draggable', 'true');
  });

  test('gravação que falha depois de um recarregamento mais novo (troca de período) não traz de volta o quadro antigo', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas, liberar } = await preparar(page, tema, { segurar: true, falhar: true });
    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await page.getByRole('menuitem', { name: 'Mover para Em execução' }).click();
    await folhaMover(page, 'EXECUCAO').getByRole('button', { name: 'Confirmar' }).click();
    await expect(contagem(page, largura, 'EXECUCAO')).toHaveText('3'); // otimista (7 dias)
    // algo tira a folha da frente enquanto grava e o período muda para 14 dias
    await page.evaluate(() => document.querySelector('dialog')?.close());
    await botaoPeriodo(page).click();
    await page.getByRole('menuitemradio', { name: '14 dias' }).click();
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 14 dias');
    await esperarQuieto(page);
    // 14 dias: ORC 3, AGP 2, EXE 3, FIN 2
    await expect(contagem(page, largura, 'ORCAMENTO')).toHaveText('3');
    await expect(contagem(page, largura, 'EXECUCAO')).toHaveText('3');

    liberar();
    await expect(page.getByRole('alert').filter({ hasText: `Não foi possível mover ${PLACA}` })).toBeVisible();
    await esperarQuieto(page);
    await expect(botaoPeriodo(page)).toHaveAccessibleName('Últimos 14 dias');
    await expect(contagem(page, largura, 'ORCAMENTO')).toHaveText('3');
    await expect(contagem(page, largura, 'AGUARDANDO_PECA')).toHaveText('2');
    await expect(contagem(page, largura, 'EXECUCAO')).toHaveText('3');
    await expect(contagem(page, largura, 'FINALIZADO')).toHaveText('2');
    await expect(cardDe(page, largura, 'ORCAMENTO')).toBeVisible();
    expect(escritas).toHaveLength(1);
  });

  test('carregamento que falha com a folha aberta: depois de "Tentar novamente" a folha antiga não volta', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema);
    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await page.getByRole('menuitem', { name: 'Mover para Finalizado' }).click();
    await expect(folhaMover(page, 'FINALIZADO')).toBeVisible();
    // a folha sai da frente sem passar pelo Cancelar e um recarregamento falha
    await page.evaluate(() => document.querySelector('dialog')?.close());
    const falhar = (route: Route) =>
      route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    await page.route(/\/api\/v1\/dashboards\//, falhar);
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByText('Não foi possível carregar o Radar. Tente novamente.')).toBeVisible();
    await page.unroute(/\/api\/v1\/dashboards\//, falhar);
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(coluna(page, largura, 'ORCAMENTO')).toBeVisible();
    await esperarQuieto(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(escritas).toEqual([]);
  });

  test('o aviso de sucesso fica na região viva mesmo se o recarregamento seguinte falhar', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await preparar(page, tema);
    const falhar = (route: Route) =>
      route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await page.getByRole('menuitem', { name: 'Mover para Em execução' }).click();
    await page.route(/\/api\/v1\/dashboards\//, falhar);
    const regiao = page.getByRole('status').filter({ hasText: `${PLACA} movida para Em execução` });
    const id = await page.evaluate(() => {
      const el = document.querySelector('[aria-live="polite"]') as HTMLElement & { __marca?: string };
      el.dataset.marca = 'mesma';
      return el.dataset.marca;
    });
    expect(id).toBe('mesma');
    await folhaMover(page, 'EXECUCAO').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText('Não foi possível carregar o Radar. Tente novamente.')).toBeVisible();
    // a mesma região (não uma nova, montada depois) segue com o anúncio
    await expect(regiao).toHaveCount(1);
    await expect(regiao).toHaveAttribute('data-marca', 'mesma');
  });
});

test.describe('radar: quem pode mudar a etapa', () => {
  test('mecânico pode (como no passo a passo da OS): arrasta no desktop e tem "Mover para"', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    await preparar(page, tema, { cargo: 'MECANICO' });
    await gatilhoMenu(page, largura, 'ORCAMENTO').click();
    await expect(page.getByRole('menuitem', { name: /^Mover para / })).toHaveCount(3);
    if (largura >= 1024) await expect(cardDe(page, largura, 'ORCAMENTO')).toHaveAttribute('draggable', 'true');
  });

  test('cargo sem permissão: sem arrasto, sem menu, sem dica', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    const { escritas } = await preparar(page, tema, { cargo: 'VISITANTE' });
    const card = cardDe(page, largura, 'ORCAMENTO');
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute('draggable', 'true');
    await expect(gatilhoMenu(page, largura, 'ORCAMENTO')).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /^Mover para / })).toHaveCount(0);
    await expect(page.getByText('Arraste um card para outra etapa para mudar o status')).toHaveCount(0);
    await expect(card.getByRole('button', { name: new RegExp(`^Placa ${PLACA}`) })).not.toHaveAttribute('aria-describedby', /.+/);
    if (largura >= 1024) {
      await card.dragTo(coluna(page, largura, 'EXECUCAO'));
      await page.waitForTimeout(300);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(escritas).toEqual([]);
    // abrir a ordem continua igual
    await card.getByRole('button', { name: new RegExp(`^Placa ${PLACA}`) }).click();
    await expect(page).toHaveURL(/osId=/);
  });
});
