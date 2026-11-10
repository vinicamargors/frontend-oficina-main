import { expect, test, type Page } from '@playwright/test';
import { EMPRESA_ID, OS_BANCADA_ID, abrirTela, exigirRedeCompleta, simularBackend } from './mocks';
import { coletarErros, contextoDoProjeto } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> };

function registrarEscritas(page: Page): Escrita[] {
  const escritas: Escrita[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' || r.method() === 'OPTIONS') return;
    if (!r.url().startsWith('http://mock.api.local/api/v1')) return;
    escritas.push({ metodo: r.method(), caminho: new URL(r.url()).pathname.replace('/api/v1', ''), corpo: r.postDataJSON() });
  });
  return escritas;
}

/** A página pública abre sem login: nada de `entrarComo`. O tema vem do sistema (colorScheme do projeto). */
async function abrir(page: Page) {
  await simularBackend(page, 'cheio');
  await abrirTela(page, 'avaliacao');
}

const sobraLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const grupo = (page: Page) => page.getByRole('radiogroup', { name: 'Sua nota para o serviço e o atendimento' });
const estrela = (page: Page, n: number) => grupo(page).getByRole('radio', { name: n === 1 ? '1 estrela' : `${n} estrelas`, exact: true });
const enviar = (page: Page) => page.getByRole('button', { name: /^(Enviar avaliação|Tentar novamente)$/ });

async function preencher(page: Page) {
  await page.getByLabel('Seu nome').fill('Maria Souza');
  await page.getByLabel('Modelo do veículo').fill('Fiat Argo 1.3');
}

test.describe('avaliação pública', () => {
  test('abre sem login: marca no topo, um título, um bloco só, nenhum dado interno da oficina', async ({ page }, info) => {
    contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page);

    await expect(page.getByRole('img', { name: 'Mecanify' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Como foi o serviço no seu carro?' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(enviar(page)).toHaveCount(1);
    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/Oficina Modelo|12\.345\.678|Marcos Almeida|DONO/);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('estrelas: grupo de rádio com 5 opções nomeadas, nota 5 de partida, alvo de 44px', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    await expect(grupo(page).getByRole('radio')).toHaveCount(5);
    await expect(estrela(page, 5)).toHaveAttribute('aria-checked', 'true');
    for (const n of [1, 2, 3, 4]) await expect(estrela(page, n)).toHaveAttribute('aria-checked', 'false');
    for (let n = 1; n <= 5; n++) {
      const b = (await estrela(page, n).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(43.5);
      expect(b.height).toBeGreaterThanOrEqual(43.5);
    }
    // o efeito de hover existe de verdade (o antigo usava scale-115, que não existe)
    await expect(estrela(page, 3)).toHaveClass(/hover:scale-110/);
    await expect(estrela(page, 3)).not.toHaveClass(/scale-115/);
  });

  test('clicar escolhe a nota e o texto de apoio acompanha, sem símbolos soltos', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    const legenda = page.getByRole('status').filter({ hasText: /Excelente|Muito bom|Regular|Abaixo|Insatisfeito/ });
    await expect(legenda).toHaveText('Excelente! Superou expectativas');
    await estrela(page, 2).click();
    await expect(estrela(page, 2)).toHaveAttribute('aria-checked', 'true');
    await expect(estrela(page, 5)).toHaveAttribute('aria-checked', 'false');
    await expect(legenda).toHaveText('Abaixo do esperado');
    await estrela(page, 1).click();
    await expect(legenda).toHaveText('Insatisfeito');
    await estrela(page, 3).click();
    await expect(legenda).toHaveText('Regular');
    await estrela(page, 4).click();
    await expect(legenda).toHaveText('Muito bom! Satisfeito');
    expect(await page.locator('body').innerText()).not.toMatch(/[★☆]/);
  });

  test('teclado: Tab entra no grupo uma vez só; setas, Home e End mudam a nota', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    // só a estrela marcada entra na ordem de tabulação
    await expect(grupo(page).locator('[role=radio][tabindex="0"]')).toHaveCount(1);
    await estrela(page, 5).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(estrela(page, 4)).toHaveAttribute('aria-checked', 'true');
    await expect(estrela(page, 4)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await expect(estrela(page, 2)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Home');
    await expect(estrela(page, 1)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(estrela(page, 5)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('End');
    await expect(estrela(page, 5)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(estrela(page, 1)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(estrela(page, 5)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(estrela(page, 1)).toHaveAttribute('aria-checked', 'true');
    // Tab sai do grupo para o campo seguinte
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Seu nome')).toBeFocused();
  });

  test('estrela apagada tem contraste de pelo menos 3:1 com o fundo do bloco', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    await estrela(page, 2).click();
    await page.mouse.move(1, 1);
    const razoes = await page.evaluate(() => {
      const luz = (rgb: string) => {
        const [r, g, b] = (rgb.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const razao = (a: string, b: string) => {
        const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const fundo = (e: Element | null): string => {
        while (e) {
          const c = getComputedStyle(e).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
          e = e.parentElement;
        }
        return 'rgb(255,255,255)';
      };
      const radios = [...document.querySelectorAll('[role=radiogroup] [role=radio]')];
      return radios.map((r, i) => {
        const svg = r.querySelector('svg')!;
        const cs = getComputedStyle(svg);
        return { n: i + 1, tracoVsFundo: razao(cs.stroke, fundo(r)) };
      });
    });
    for (const r of razoes) expect(r.tracoVsFundo, `traço da estrela ${r.n}`).toBeGreaterThanOrEqual(3);
  });

  test('um único cartão: nenhum bloco com fundo dentro de outro, e botão primário único', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    const resultado = await page.locator('body').evaluate((body) => {
      const comFundoArredondado = [...body.querySelectorAll('*')].filter((e) => {
        const cs = getComputedStyle(e);
        const arredondado = parseFloat(cs.borderTopLeftRadius) >= 12;
        const tag = e.tagName.toLowerCase();
        return arredondado && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !['input', 'textarea', 'button', 'select'].includes(tag);
      });
      const aninhados = comFundoArredondado.filter((c) => comFundoArredondado.some((o) => o !== c && o.contains(c)));
      const comBorda = [...body.querySelectorAll('*')].filter((e) => {
        const tag = e.tagName.toLowerCase();
        return !['input', 'textarea', 'button', 'select'].includes(tag) && parseFloat(getComputedStyle(e).borderTopWidth) >= 1;
      });
      return { cartoes: comFundoArredondado.length, aninhados: aninhados.length, comBorda: comBorda.length };
    });
    expect(resultado.aninhados).toBe(0);
    expect(resultado.cartoes).toBeLessThanOrEqual(1);
    expect(resultado.comBorda).toBe(0);
  });

  test('enviar leva exatamente os mesmos campos de antes e mostra o agradecimento', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    const escritas = registrarEscritas(page);
    await estrela(page, 4).click();
    await preencher(page);
    await page.getByLabel(/Comentário/).fill('  Atendimento rápido.  ');
    await enviar(page).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Mecanify' })).toBeVisible();
    await expect(page.getByLabel('Seu nome')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    expect(escritas).toHaveLength(1);
    const { metodo, caminho, corpo } = escritas[0];
    expect(metodo).toBe('POST');
    expect(caminho).toBe('/equipe/avaliar');
    expect(corpo).toMatchObject({
      empresa_id: EMPRESA_ID,
      os_id: OS_BANCADA_ID,
      cliente_nome: 'Maria Souza',
      veiculo_modelo: 'Fiat Argo 1.3',
      veiculo_placa: 'AUT-0000',
      nota: 4,
      comentario: 'Atendimento rápido.',
    });
    expect(Object.keys(corpo).sort()).toEqual(['cliente_nome', 'comentario', 'data', 'empresa_id', 'nota', 'os_id', 'veiculo_modelo', 'veiculo_placa']);
    expect(Number.isNaN(Date.parse(corpo.data as string))).toBe(false);
  });

  test('comentário e veículo são opcionais; nome é obrigatório e sem ele nada é enviado', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    const escritas = registrarEscritas(page);
    await enviar(page).click();
    await expect(page.getByLabel('Seu nome')).toBeFocused();
    expect(escritas).toHaveLength(0);
    await page.getByLabel('Seu nome').fill('João');
    await enviar(page).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' })).toBeVisible();
    expect(escritas[0].corpo).toMatchObject({ cliente_nome: 'João', veiculo_modelo: 'Veículo do Cliente', comentario: null, nota: 5 });
  });

  test('enviando: botão ocupado e bloqueado, sem envio duplicado', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    await page.route('**/api/v1/equipe/avaliar', async (r) => {
      await new Promise((ok) => setTimeout(ok, 1200));
      await r.fallback();
    });
    const escritas = registrarEscritas(page);
    await preencher(page);
    await enviar(page).click();
    const ocupado = page.getByRole('button', { name: 'Enviando…' });
    await expect(ocupado).toBeDisabled();
    await expect(ocupado).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' })).toBeVisible();
    expect(escritas).toHaveLength(1);
  });

  test('erro: diz o problema, mantém tudo o que foi digitado e "Tentar novamente" envia', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    let falhar = true;
    await page.route('**/api/v1/equipe/avaliar', async (r) => {
      if (falhar) {
        return r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'x' }) });
      }
      await r.fallback();
    });
    await estrela(page, 3).click();
    await preencher(page);
    await page.getByLabel(/Comentário/).fill('Demorou um pouco.');
    await enviar(page).click();
    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText('Não foi possível enviar sua avaliação');
    await expect(alerta).toContainText('Tente novamente');
    await expect(estrela(page, 3)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Seu nome')).toHaveValue('Maria Souza');
    await expect(page.getByLabel('Modelo do veículo')).toHaveValue('Fiat Argo 1.3');
    await expect(page.getByLabel(/Comentário/)).toHaveValue('Demorou um pouco.');

    falhar = false;
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' })).toBeVisible();
  });

  test('celular e desktop: campos de 44px no celular (40px no desktop), sem rolagem lateral, sem texto menor que 12px', async ({ page }, info) => {
    const { largura } = contextoDoProjeto(info);
    await abrir(page);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    for (const alvo of await page.locator('input, textarea, button').all()) {
      expect((await alvo.boundingBox())!.height).toBeGreaterThanOrEqual(largura < 1024 ? 43.5 : 39.5);
    }
    const pequenos = await page.locator('body').evaluate((body) =>
      [...body.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length
    );
    expect(pequenos).toBe(0);
    // o bloco cabe na largura e fica centralizado
    const b = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 0.5);
  });

  test('o agradecimento também cabe sem rolagem lateral e leva o foco ao título', async ({ page }, info) => {
    contextoDoProjeto(info);
    await abrir(page);
    await page.getByLabel('Seu nome').fill('Ana');
    await enviar(page).click();
    const h1 = page.getByRole('heading', { level: 1, name: 'Obrigado pela sua avaliação' });
    await expect(h1).toBeFocused();
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });
});
