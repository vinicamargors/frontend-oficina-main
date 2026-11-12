import { expect, test, type Page } from '@playwright/test';
import { EMPRESA_ID, abrirTela, avaliacoes, empresa, entrarComo, escalas, exigirRedeCompleta, simularBackend, usuarios, type Cenario } from './mocks';
import { coletarErros, contextoDoProjeto, exigirFocoNoPrimeiroCampo } from './contexto';

type Escrita = { metodo: string; caminho: string; corpo: Record<string, unknown> } | undefined;
const ultimaEscrita = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ultimaEscrita?: unknown }).__ultimaEscrita as Escrita);

async function abrir(page: Page, tema: 'claro' | 'escuro', cenario: Cenario = 'cheio') {
  await simularBackend(page, cenario);
  await entrarComo(page, 'DONO', tema);
  await abrirTela(page, 'equipe');
}

const abas = (page: Page) => page.getByRole('tablist', { name: 'Seções da equipe' });
const irParaAba = (page: Page, rotulo: string) => abas(page).getByRole('tab', { name: rotulo }).click();
const lista = (page: Page) => page.getByRole('list', { name: 'Colaboradores' });
const linha = (page: Page, nome: string) => lista(page).getByRole('listitem').filter({ hasText: nome }).first();
const sobraLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const menuDe = (page: Page, nome: string) => page.getByRole('button', { name: `Mais ações de ${nome}` }).click();

const ATIVOS = usuarios.filter((u) => u.ativo);
const INATIVO = usuarios.find((u) => !u.ativo)!;
const TIAGO = usuarios[3]; // mecânico ativo, 4.6 (12)
const RAFAEL = usuarios[2]; // atendente
const TOTAL_FOLHA = ATIVOS.reduce((s, u) => s + (u.salario_base ?? 0) + (u.vale_transporte ?? 0) + (u.vale_refeicao ?? 0), 0);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ');
const ENUM_CRU = /\b(DONO|MECANICO|ATENDENTE|FINANCEIRO|FERIAS|FOLGA|ENTRADA)\b/;

async function abrirHolerite(page: Page, nome = TIAGO.nome) {
  await page.getByRole('button', { name: `Ver holerite de ${nome}` }).click();
  await page.getByRole('dialog', { name: 'Holerite' }).locator('#holerite-impressao').waitFor();
  // pelo id: em `print` só o bloco fica visível e a folha (dialog) sai da árvore de acessibilidade
  return page.locator('#holerite-impressao');
}

/** Sobrescreve a empresa devolvida em `/empresas/?empresa_id=` (null = lista vazia). */
async function empresaDoHolerite(page: Page, dados: { razao_social: string; nome_fantasia: string; cnpj: string } | null) {
  await page.route(/\/api\/v1\/empresas\/\?empresa_id=/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(dados ? [{ ...empresa, ...dados }] : []),
    })
  );
}

test.describe('colaboradores', () => {
  test('cabeçalho, abas, todos os colaboradores numa lista e sem rolagem lateral', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    const erros = coletarErros(page);
    await abrir(page, tema);

    await expect(page.getByRole('heading', { level: 1, name: 'Equipe & RH' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).locator('xpath=..')).toContainText(String(ATIVOS.length));
    await expect(page.getByRole('button', { name: /Novo colaborador/ })).toHaveCount(1);
    await expect(abas(page).getByRole('tab')).toHaveText(['Equipe', 'Folha', 'Escalas', 'Ponto', 'Avaliações']);
    await expect(abas(page).getByRole('tab', { name: 'Equipe' })).toHaveAttribute('aria-selected', 'true');

    // ativos e desativados na mesma lista vertical, desativados por último
    await expect(lista(page).getByRole('listitem')).toHaveCount(usuarios.length);
    await expect(lista(page).getByRole('listitem').last()).toContainText(INATIVO.nome);
    await expect(linha(page, INATIVO.nome)).toContainText('Inativo');
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
    expect(erros).toEqual([]);
  });

  test('cargo legível, salário, comissão, contatos e avaliação em cada linha; nunca o enum cru', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    const t = linha(page, TIAGO.nome);
    await expect(t).toContainText('Mecânico');
    await expect(t).toContainText(/R\$\s3\.200,00/);
    await expect(t).toContainText('15% M.O.');
    await expect(t).toContainText('5% peças');
    await expect(t).toContainText(TIAGO.telefone!);
    await expect(t).toContainText(TIAGO.email);
    await expect(t).toContainText('4,6');
    await expect(t).toContainText('12 aval.');
    await expect(linha(page, usuarios[0].nome)).toContainText('Dono');
    await expect(linha(page, RAFAEL.nome)).toContainText('Atendente');
    await expect(linha(page, usuarios[1].nome)).toContainText('Financeiro');
    await expect(linha(page, RAFAEL.nome)).toContainText('Sem avaliações');
    expect(await page.getByRole('main').innerText()).not.toMatch(ENUM_CRU);
  });

  test('menu da linha: holerite, editar, desativar (ativo) ou reativar (inativo)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, TIAGO.nome);
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([/Ver holerite/, /Editar colaborador/, /Desativar colaborador/]);
    await page.keyboard.press('Escape');
    await menuDe(page, INATIVO.nome);
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([/Ver holerite/, /Editar colaborador/, /Reativar colaborador/]);
  });

  test('desativar exige confirmação; cancelar não grava; confirmar marca como inativo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, TIAGO.nome);
    await page.getByRole('menuitem', { name: /Desativar colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Desativar colaborador?' });
    await expect(d).toContainText(TIAGO.nome);
    await expect(d).toContainText('folha de pagamento');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();

    await menuDe(page, TIAGO.nome);
    await page.getByRole('menuitem', { name: /Desativar colaborador/ }).click();
    await d.getByRole('button', { name: 'Desativar' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('DELETE');
    expect(e.caminho).toBe(`/usuarios/${EMPRESA_ID}/${TIAGO.id}`);
    await expect(d).toHaveCount(0);
    await expect(linha(page, TIAGO.nome)).toContainText('Inativo');
    await expect(page.getByRole('status').filter({ hasText: 'desativado' })).toBeVisible();
  });

  test('reativar exige confirmação', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, INATIVO.nome);
    await page.getByRole('menuitem', { name: /Reativar colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Reativar colaborador?' });
    await expect(d).toContainText(INATIVO.nome);
    expect(await ultimaEscrita(page)).toBeUndefined();
    await d.getByRole('button', { name: 'Reativar' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('PATCH');
    expect(e.caminho).toBe(`/usuarios/${EMPRESA_ID}/${INATIVO.id}/reativar`);
    await expect(linha(page, INATIVO.nome)).not.toContainText('Inativo');
  });

  test('convite por WhatsApp abre numa folha com cargo legível', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Convidar/ }).click();
    const d = page.getByRole('dialog', { name: 'Convidar por WhatsApp' });
    await expect(d.getByLabel('Nome do colaborador')).toBeVisible();
    await expect(d.getByLabel('Cargo').locator('option')).toHaveText(['Mecânico / técnico', 'Atendente / recepção', 'Financeiro', 'Dono / administrador']);
    await expect(d.getByRole('button', { name: /Enviar convite no WhatsApp/ })).toBeVisible();
  });
});

test.describe('formulário do colaborador', () => {
  test('abre com o foco no primeiro campo', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    await exigirFocoNoPrimeiroCampo(page.getByRole('dialog', { name: 'Novo colaborador' }), /Nome completo/);
  });

  test('novo: salva todos os campos de RH digitados', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Novo colaborador' });
    await d.getByLabel(/Nome completo/).fill('Bruno Lima');
    await d.getByLabel(/E-mail de acesso/).fill('bruno@oficina.example.com');
    await d.getByLabel(/Telefone/).fill('11977776666');
    await d.getByLabel('Cargo *').selectOption('ATENDENTE');
    await d.getByLabel(/Salário base/).fill('2800');
    await d.getByLabel(/Comissão M\.O\./).fill('10');
    await d.getByLabel(/Comissão peças/).fill('3');
    await d.getByLabel(/Vale-transporte/).fill('200');
    await d.getByLabel(/Vale-refeição/).fill('500');
    await d.getByLabel(/Valor da hora extra/).fill('30');
    await d.getByLabel(/Senha inicial/).fill('segredo1');
    await d.getByRole('button', { name: 'Salvar colaborador' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    expect(e.corpo).toMatchObject({
      nome: 'Bruno Lima',
      email: 'bruno@oficina.example.com',
      cargo: 'ATENDENTE',
      senha: 'segredo1',
      salario_base: 2800,
      comissao_servico_pct: 10,
      comissao_peca_pct: 3,
      vale_transporte: 200,
      vale_refeicao: 500,
      paga_hora_extra: true,
      valor_hora_extra: 30,
    });
    await expect(d).toHaveCount(0);
    await expect(lista(page)).toContainText('Bruno Lima');
  });

  test('novo sem senha inicial mostra erro e não grava (sem senha padrão conhecida)', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Novo colaborador' });
    await d.getByLabel(/Nome completo/).fill('Sem Senha');
    await d.getByLabel(/E-mail de acesso/).fill('semsenha@oficina.example.com');
    await d.getByRole('button', { name: 'Salvar colaborador' }).click();
    await expect(d.getByRole('alert')).toContainText('senha inicial');
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('editar abre preenchido; senha curta mostra erro na folha e não grava', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, TIAGO.nome);
    await page.getByRole('menuitem', { name: /Editar colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Editar colaborador' });
    await expect(d.getByLabel(/Nome completo/)).toHaveValue(TIAGO.nome);
    await expect(d.getByLabel(/Salário base/)).toHaveValue('3200');
    await expect(d.getByLabel('Cargo *')).toHaveValue('MECANICO');
    await d.getByLabel(/Nova senha/).fill('123');
    await d.getByRole('button', { name: 'Salvar colaborador' }).click();
    await expect(d.getByRole('alert')).toContainText('mínimo 6 caracteres');
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('Esc com dados digitados pede "Descartar alterações?"; sem alteração fecha direto', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Novo colaborador' });
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);

    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    // digitar de verdade (teclas) dá ativação de usuário, como no celular; sem ela o Chrome não deixa o Esc ser
    // interceptado se passarem mais de 5 s (fill() não gera teclas e falhava sob carga)
    await d.getByLabel(/Nome completo/).pressSequentially('Alguém');
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByLabel(/Nome completo/)).toHaveValue('Alguém');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toHaveCount(0);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('"Desativar" dentro do formulário também pede confirmação', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, RAFAEL.nome);
    await page.getByRole('menuitem', { name: /Editar colaborador/ }).click();
    await page.getByRole('dialog', { name: 'Editar colaborador' }).getByRole('button', { name: 'Desativar' }).click();
    await expect(page.getByRole('dialog', { name: 'Desativar colaborador?' })).toBeVisible();
    expect(await ultimaEscrita(page)).toBeUndefined();
  });
});

test.describe('folha e holerite', () => {
  test('total da folha em destaque e cada colaborador ativo com base, comissões, VT/VR e líquido', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Folha');
    await expect(page.getByText(brl(TOTAL_FOLHA), { exact: true })).toBeVisible();
    await expect(page.getByText(/Pagamento no dia 5/)).toBeVisible();
    const folha = page.getByRole('list', { name: 'Folha do mês' });
    await expect(folha.getByRole('listitem')).toHaveCount(ATIVOS.length);
    const t = folha.getByRole('listitem').filter({ hasText: TIAGO.nome });
    await expect(t).toContainText('Mecânico');
    await expect(t).toContainText(/R\$\s3\.200,00/);
    await expect(t).toContainText(/\+ R\$\s820,00/);
    await expect(t).toContainText(/\+ R\$\s0,00/);
    await expect(t).toContainText(/R\$\s4\.020,00/);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    expect(await page.getByRole('main').innerText()).not.toMatch(ENUM_CRU);
  });

  test('lançar a folha em contas a pagar exige confirmação com valor e vencimento', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Folha');
    await page.getByLabel('Mês de referência').fill('2026-11');
    await page.getByRole('button', { name: /Lançar em contas a pagar/ }).click();
    const d = page.getByRole('dialog', { name: 'Lançar folha em contas a pagar?' });
    await expect(d).toContainText(brl(TOTAL_FOLHA));
    await expect(d).toContainText('05/12/2026');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();

    await page.getByRole('button', { name: /Lançar em contas a pagar/ }).click();
    await d.getByRole('button', { name: /Lançar folha de/ }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    expect(e.corpo).toMatchObject({
      tipo: 'DESPESA',
      categoria: 'FOLHA_PAGAMENTO',
      valor: TOTAL_FOLHA,
      data_vencimento: '2026-12-05',
      status: 'PENDENTE',
      descricao: 'Folha de Pagamento & Comissões — Mês 11/2026',
    });
    await expect(page.getByRole('status').filter({ hasText: 'agendada' })).toBeVisible();
  });

  test('holerite: bloco branco com tinta preta, mesmos valores, cargo legível, mês por extenso e empresa', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Folha');
    await page.getByLabel('Mês de referência').fill('2026-11');
    const h = await abrirHolerite(page);
    await expect(h).toHaveAttribute('class', 'bg-white text-black p-5 rounded-xl border-2 border-black space-y-4 font-mono text-xs select-all');
    // identidade da oficina (fixture: razão social e CNPJ já formatado)
    await expect(h.getByRole('heading')).toHaveText('Oficina Modelo Mecanify Ltda');
    await expect(h).toContainText('CNPJ 12.345.678/0001-90');
    await expect(h).not.toContainText('MECANIFY • OFICINA MECÂNICA');
    await expect(h).toContainText('Recibo de pagamento de salário e comissões');
    await expect(h).toContainText('Mês de referência: novembro de 2026');
    await expect(h).not.toContainText('2026-11');
    await expect(h).toContainText('Cargo: Mecânico');
    expect(await h.innerText()).not.toMatch(/MECANICO|undefined|null/);
    await expect(h).toContainText(TIAGO.nome);
    await expect(h).toContainText('Data de pagamento: Dia 5');
    // valores idênticos aos de antes
    await expect(h).toContainText('Auxílio transporte (VT)');
    await expect(h).toContainText(/R\$\s3\.200,00/);
    await expect(h).toContainText(/R\$\s220,00/);
    await expect(h).toContainText(/R\$\s600,00/);
    await expect(h).toContainText(/Valor líquido a receber:\s*R\$\s4\.020,00/);
    await expect(h).toContainText('Assinatura do colaborador: Tiago Ferreira');
    const cores = await h.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    expect(cores).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    const d = page.getByRole('dialog', { name: 'Holerite' });
    await expect(d.getByRole('button', { name: /Imprimir holerite/ })).toBeVisible();

    // impressão: continua preto no branco
    await page.emulateMedia({ media: 'print' });
    const coresImpressao = await h.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
    expect(coresImpressao).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    await page.emulateMedia({ media: 'screen' });
    await d.getByRole('button', { name: 'Fechar' }).click();
    await expect(d).toHaveCount(0);
  });

  test('holerite: sem razão social usa o nome fantasia e CNPJ só com dígitos ganha máscara', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await empresaDoHolerite(page, { razao_social: '', nome_fantasia: 'Auto Center Silva', cnpj: '12345678000190' });
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'equipe');
    await irParaAba(page, 'Folha');
    const h = await abrirHolerite(page);
    await expect(h.getByRole('heading')).toHaveText('Auto Center Silva');
    await expect(h).toContainText('CNPJ 12.345.678/0001-90');
  });

  test('holerite: sem dados da empresa mostra o nome padrão e nenhuma linha de CNPJ', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await empresaDoHolerite(page, null);
    await entrarComo(page, 'DONO', tema);
    await abrirTela(page, 'equipe');
    await irParaAba(page, 'Folha');
    const h = await abrirHolerite(page);
    await expect(h.getByRole('heading')).not.toHaveText('');
    await expect(h).not.toContainText('CNPJ');
    expect(await h.innerText()).not.toMatch(/undefined|null/);
  });

  for (const largura of [360, 390]) {
    test(`holerite em ${largura}px: nada se sobrepõe nem vaza (tela e impressão)`, async ({ page }, info) => {
      const { tema } = contextoDoProjeto(info);
      await page.setViewportSize({ width: largura, height: 800 });
      await abrir(page, tema);
      await irParaAba(page, 'Folha');
      const h = await abrirHolerite(page);
      for (const midia of ['screen', 'print'] as const) {
        await page.emulateMedia({ media: midia });
        const problemas = await h.evaluate((bloco) => {
          const caixa = bloco.getBoundingClientRect();
          const erros: string[] = [];
          if (bloco.scrollWidth > bloco.clientWidth + 1) erros.push(`bloco rola: ${bloco.scrollWidth} > ${bloco.clientWidth}`);
          for (const el of Array.from(bloco.querySelectorAll<HTMLElement>('*'))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            if (r.right > caixa.right + 1 || r.left < caixa.left - 1) erros.push(`vaza: ${el.tagName} "${el.textContent?.slice(0, 30)}"`);
          }
          // campos do cabeçalho do colaborador não se sobrepõem
          const campos = Array.from(bloco.querySelectorAll<HTMLElement>('[data-campo]')).map((e) => [e.dataset.campo, e.getBoundingClientRect()] as const);
          for (let i = 0; i < campos.length; i++)
            for (let j = i + 1; j < campos.length; j++) {
              const [na, a] = campos[i];
              const [nb, b] = campos[j];
              const cruza = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
              if (cruza) erros.push(`sobreposição: ${na} × ${nb}`);
            }
          if (campos.length < 4) erros.push('campos do colaborador não marcados');
          return erros;
        });
        expect(problemas, midia).toEqual([]);
      }
      await page.emulateMedia({ media: 'screen' });
      expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('escalas', () => {
  test('períodos com tipo legível e datas; excluir exige confirmação', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Escalas');
    const l = page.getByRole('list', { name: 'Escalas e férias' });
    await expect(l.getByRole('listitem')).toHaveCount(escalas('cheio').length);
    const ferias = l.getByRole('listitem').filter({ hasText: TIAGO.nome });
    await expect(ferias).toContainText('Férias');
    await expect(ferias).toContainText('Férias programadas');
    expect(await page.getByRole('main').innerText()).not.toMatch(ENUM_CRU);

    await ferias.getByRole('button', { name: `Excluir período de ${TIAGO.nome}` }).click();
    const d = page.getByRole('dialog', { name: 'Excluir período?' });
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();
    await ferias.getByRole('button', { name: `Excluir período de ${TIAGO.nome}` }).click();
    await d.getByRole('button', { name: 'Excluir período' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    expect((await ultimaEscrita(page))!.metodo).toBe('DELETE');
    await expect(l.getByRole('listitem')).toHaveCount(escalas('cheio').length - 1);
  });

  test('agendar férias numa folha e salvar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Escalas');
    await page.getByRole('button', { name: /Agendar férias ou folga/ }).click();
    const d = page.getByRole('dialog', { name: 'Agendar férias ou folga' });
    await expect(d.getByLabel('Colaborador *').locator('option', { hasText: `${TIAGO.nome} (Mecânico)` })).toHaveCount(1);
    await d.getByLabel('Colaborador *').selectOption(TIAGO.id);
    await d.getByLabel('Tipo de período *').selectOption('FOLGA');
    await d.getByRole('button', { name: 'Salvar período' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    expect(e.corpo).toMatchObject({ usuario_id: TIAGO.id, usuario_nome: TIAGO.nome, tipo: 'FOLGA' });
    await expect(d).toHaveCount(0);
  });
});

// 10/11/2026 às 22:00 em São Paulo = 01:00Z do dia 11: em UTC "hoje" já virou amanhã.
const NOITE_SP = new Date('2026-11-11T01:00:00Z');

test.describe('datas no calendário local (22h em São Paulo)', () => {
  // Fase 5: data e hora do ponto são do servidor (America/Sao_Paulo, testado no backend); o navegador não manda nem as dele.
  test('ponto batido às 22h: o navegador não envia data nem hora (o servidor decide em Brasília)', async ({ page, context }, info) => {
    const { tema } = contextoDoProjeto(info);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -23.55052, longitude: -46.633308 });
    await page.clock.setFixedTime(NOITE_SP);
    await abrir(page, tema);
    await irParaAba(page, 'Ponto');
    await page.getByRole('button', { name: 'Bater ponto agora' }).click();
    await page.getByRole('dialog', { name: 'Registrar ponto agora?' }).getByRole('button', { name: 'Registrar ponto' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const corpo = (await ultimaEscrita(page))!.corpo as Record<string, unknown>;
    expect(corpo).toMatchObject({ tipo: 'ENTRADA' });
    for (const proibido of ['data', 'hora', 'usuario_id', 'dentro_raio', 'distancia_metros']) expect(corpo).not.toHaveProperty(proibido);
  });

  test('agendar período às 22h: começa hoje e termina em 15 dias, no calendário local', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await page.clock.setFixedTime(NOITE_SP);
    await abrir(page, tema);
    await irParaAba(page, 'Escalas');
    await page.getByRole('button', { name: /Agendar férias ou folga/ }).click();
    const d = page.getByRole('dialog', { name: 'Agendar férias ou folga' });
    await expect(d.getByLabel('Data início *')).toHaveValue('2026-11-10');
    await expect(d.getByLabel('Data fim *')).toHaveValue('2026-11-25');
  });
});

test.describe('ponto eletrônico', () => {
  test('bater ponto pede confirmação, valida o raio por GPS e lista o registro', async ({ page, context }, info) => {
    const { tema } = contextoDoProjeto(info);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -23.55052, longitude: -46.633308 });
    await abrir(page, tema);
    await irParaAba(page, 'Ponto');
    await expect(page.getByText('150 m')).toBeVisible();
    const hist = page.getByRole('list', { name: 'Últimos registros de ponto' });
    await expect(hist.getByRole('listitem')).toHaveCount(2);
    await expect(hist.getByRole('listitem').first()).toContainText('Entrada');
    await expect(hist.getByRole('listitem').first()).toContainText('No raio');

    await page.getByRole('button', { name: 'Bater ponto agora' }).click();
    const d = page.getByRole('dialog', { name: 'Registrar ponto agora?' });
    await d.getByRole('button', { name: 'Cancelar' }).click();
    expect(await ultimaEscrita(page)).toBeUndefined();

    await page.getByRole('button', { name: 'Bater ponto agora' }).click();
    await d.getByRole('button', { name: 'Registrar ponto' }).click();
    await expect.poll(() => ultimaEscrita(page)).toBeTruthy();
    const e = (await ultimaEscrita(page))!;
    expect(e.metodo).toBe('POST');
    // só tipo e coordenadas: usuário, data, hora e "dentro do raio" são do servidor (fase 5)
    expect(e.corpo).toEqual({ tipo: 'ENTRADA', latitude: -23.55052, longitude: -46.633308 });
    const aviso = page.getByRole('status').filter({ hasText: 'dentro do raio' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('08:15');   // a hora mostrada é a que o servidor gravou
    await expect(hist.getByRole('listitem')).toHaveCount(3);
  });
});

test.describe('avaliações', () => {
  test('estrelas com "N de 5" em texto, média e comentário', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await irParaAba(page, 'Avaliações');
    const l = page.getByRole('list', { name: 'Avaliações dos clientes' });
    const avs = avaliacoes('cheio');
    await expect(l.getByRole('listitem')).toHaveCount(avs.length);
    await expect(l.getByRole('img', { name: '5 de 5' })).toHaveCount(avs.filter((a) => a.nota === 5).length);
    await expect(l.getByRole('img', { name: '3 de 5' })).toHaveCount(1);
    await expect(l.getByRole('listitem').first()).toContainText('5 de 5');
    await expect(l).toContainText('Serviço excelente');
    await expect(page.getByText('4,4', { exact: true })).toBeVisible();
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('celular', () => {
  test('abas numa linha só (rolam dentro da faixa) e sem rolar a página', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    const faixa = (await abas(page).boundingBox())!;
    expect(faixa.height).toBeLessThanOrEqual(56);
    expect(faixa.x + faixa.width).toBeLessThanOrEqual(largura);
    for (const t of await abas(page).getByRole('tab').all()) {
      const b = (await t.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(b.y - faixa.y)).toBeLessThanOrEqual(8);
    }
    // a última aba fica à vista quando escolhida
    await abas(page).getByRole('tab', { name: 'Avaliações' }).click();
    const ativa = (await abas(page).getByRole('tab', { name: 'Avaliações' }).boundingBox())!;
    expect(ativa.x + ativa.width).toBeLessThanOrEqual(largura);
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
  });

  test('todos os colaboradores numa lista vertical, linhas de 60 a 96px, alvos de 44px', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    const itens = await lista(page).getByRole('listitem').all();
    expect(itens).toHaveLength(usuarios.length);
    let yAnterior = -1;
    for (const li of itens) {
      const c = (await li.boundingBox())!;
      expect(c.height).toBeGreaterThanOrEqual(60);
      expect(c.height).toBeLessThanOrEqual(96);
      expect(c.y).toBeGreaterThan(yAnterior);
      expect(c.x + c.width).toBeLessThanOrEqual(largura);
      yAnterior = c.y;
    }
    for (const aba of ['Equipe', 'Folha', 'Escalas', 'Ponto', 'Avaliações']) {
      await irParaAba(page, aba);
      for (const b of await page.getByRole('main').getByRole('button').all()) {
        if (!(await b.isVisible())) continue;
        const bb = (await b.boundingBox())!;
        expect(bb.height, `${aba}: ${await b.textContent()}`).toBeGreaterThanOrEqual(44);
      }
      expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    }
  });

  test('folha no celular: linhas compactas mostram base, comissões, VT/VR e líquido', async ({ page }, info) => {
    const { tema, largura } = contextoDoProjeto(info);
    test.skip(largura >= 1024, 'só celular');
    await abrir(page, tema);
    await irParaAba(page, 'Folha');
    const t = page.getByRole('list', { name: 'Folha do mês' }).getByRole('listitem').filter({ hasText: TIAGO.nome });
    for (const texto of [/R\$\s3\.200,00/, /\+ R\$\s820,00/, /R\$\s4\.020,00/, /Comissões/]) {
      await expect(t.getByText(texto).first()).toBeVisible();
    }
    expect((await t.boundingBox())!.height).toBeLessThanOrEqual(96);
  });
});

test.describe('estados', () => {
  test('carregando mostra esqueleto, não área vazia', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    let liberar: () => void = () => {};
    const espera = new Promise<void>((r) => (liberar = r));
    await page.route(`**/api/v1/usuarios/${EMPRESA_ID}`, async (route) => {
      if (route.request().method() === 'GET') await espera;
      return route.fallback();
    });
    await entrarComo(page, 'DONO', tema);
    await page.goto('/?tab=equipe');
    await expect(page.getByRole('heading', { level: 1, name: 'Equipe & RH' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando' })).toBeVisible();
    await expect(lista(page)).toHaveCount(0);
    liberar();
    await expect(lista(page).getByRole('listitem')).toHaveCount(usuarios.length);
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
  });

  test('vazio: só o dono na equipe e estados vazios com orientação nas outras abas', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema, 'vazio');
    await expect(lista(page).getByRole('listitem')).toHaveCount(1);
    await irParaAba(page, 'Escalas');
    await expect(page.getByRole('heading', { name: 'Nenhuma escala ou férias agendada' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agendar férias ou folga/ })).toBeVisible();
    await irParaAba(page, 'Ponto');
    await expect(page.getByText('Nenhum ponto registrado ainda.')).toBeVisible();
    await irParaAba(page, 'Avaliações');
    await expect(page.getByRole('heading', { name: 'Nenhuma avaliação recebida ainda' })).toBeVisible();
    expect(await sobraLateral(page)).toBeLessThanOrEqual(0);
    exigirRedeCompleta(page);
  });

  test('perfil sem gestão (mecânico) não vê a equipe: volta ao pátio', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'MECANICO', tema);
    await abrirTela(page, 'equipe');
    await expect(page).toHaveURL(/tab=patio/);
    await expect(lista(page)).toHaveCount(0);
    await expect(page.getByText(/R\$\s3\.200,00/)).toHaveCount(0);
  });
});

// ------------------------------------------------------------------ polimento: erros, ponto, avaliações e hora extra
const falha500 = { status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ detail: 'Servidor fora do ar' }) };
const jsonOk = (corpo: unknown) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(corpo) });

test.describe('polimento da equipe', () => {
  test('ponto: falha ao gravar mostra o erro e o botão volta a "Bater ponto agora"', async ({ page, context }, info) => {
    const { tema } = contextoDoProjeto(info);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -23.55052, longitude: -46.633308 });
    await abrir(page, tema);
    await page.route('**/api/v1/equipe/pontos/*', (r) => (r.request().method() === 'POST' ? r.fulfill(falha500) : r.fallback()));
    await irParaAba(page, 'Ponto');
    await page.getByRole('button', { name: 'Bater ponto agora' }).click();
    await page.getByRole('dialog', { name: 'Registrar ponto agora?' }).getByRole('button', { name: 'Registrar ponto' }).click();
    await expect(page.getByRole('main').getByRole('status').filter({ hasText: /Erro ao registrar o ponto/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bater ponto agora' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Verificando GPS…' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Últimos registros de ponto' }).getByRole('listitem')).toHaveCount(2);
  });

  test('erro de carga continua na tela depois de abrir e fechar o formulário', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    await page.route(`**/api/v1/usuarios/${EMPRESA_ID}`, (r) => (r.request().method() === 'GET' ? r.fulfill(falha500) : r.fallback()));
    await abrirTela(page, 'equipe');
    const alertaPagina = page.getByRole('main').getByRole('alert').filter({ hasText: 'Servidor fora do ar' });
    await expect(alertaPagina).toBeVisible();
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Novo colaborador' });
    await expect(d.getByRole('alert')).toHaveCount(0); // o erro da página não entra no formulário
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    await expect(alertaPagina).toBeVisible();
  });

  test('erro ao salvar fica só no formulário e não sobra na página depois de fechar', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await page.route(`**/api/v1/usuarios/${EMPRESA_ID}`, (r) => (r.request().method() === 'POST' ? r.fulfill(falha500) : r.fallback()));
    await page.getByRole('button', { name: /Novo colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Novo colaborador' });
    await d.getByLabel(/Nome completo/).fill('Bruno Lima');
    await d.getByLabel(/E-mail/).fill('bruno@oficinamodelo.example.com');
    await d.getByLabel(/Senha inicial/).fill('segredo1');
    await d.getByRole('button', { name: 'Salvar colaborador' }).click();
    await expect(d.getByRole('alert')).toContainText('Erro ao salvar colaborador');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click();
    await expect(d).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });

  test('"Desativar" com o formulário alterado pergunta "Descartar alterações?" antes', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await abrir(page, tema);
    await menuDe(page, RAFAEL.nome);
    await page.getByRole('menuitem', { name: /Editar colaborador/ }).click();
    const d = page.getByRole('dialog', { name: 'Editar colaborador' });
    await d.getByLabel(/Nome completo/).fill('Rafael Nunes Alterado');
    await d.getByRole('button', { name: 'Desativar' }).click();
    await expect(d.getByRole('alert')).toContainText('Descartar alterações?');
    await expect(page.getByRole('dialog', { name: 'Desativar colaborador?' })).toHaveCount(0);
    await d.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(d.getByLabel(/Nome completo/)).toHaveValue('Rafael Nunes Alterado');

    await d.getByRole('button', { name: 'Desativar' }).click();
    await d.getByRole('button', { name: 'Descartar' }).click();
    const conf = page.getByRole('dialog', { name: 'Desativar colaborador?' });
    await expect(conf).toBeVisible();
    await expect(conf).toContainText(RAFAEL.nome);
    expect(await ultimaEscrita(page)).toBeUndefined();
  });

  test('avaliação: decide pela média (sem total mostra só a média; sem média é "Sem avaliações")', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    const lista = usuarios.map((u) =>
      u.id === TIAGO.id ? { ...u, estrelas_media: 4.2, total_avaliacoes: undefined } : u.id === RAFAEL.id ? { ...u, estrelas_media: null, total_avaliacoes: 3 } : u
    );
    await page.route(`**/api/v1/usuarios/${EMPRESA_ID}`, (r) => (r.request().method() === 'GET' ? r.fulfill(jsonOk(lista)) : r.fallback()));
    await abrirTela(page, 'equipe');
    const t = linha(page, TIAGO.nome);
    await expect(t).toContainText('4,2');
    await expect(t).not.toContainText('Sem avaliações');
    await expect(t).not.toContainText('aval.');
    await expect(linha(page, RAFAEL.nome)).toContainText('Sem avaliações');
  });

  test('editar sem mexer na hora extra envia paga_hora_extra e valor_hora_extra como vieram', async ({ page }, info) => {
    const { tema } = contextoDoProjeto(info);
    await simularBackend(page, 'cheio');
    await entrarComo(page, 'DONO', tema);
    const lista = usuarios.map((u) => (u.id === RAFAEL.id ? { ...u, paga_hora_extra: false, valor_hora_extra: 40 } : u));
    await page.route(`**/api/v1/usuarios/${EMPRESA_ID}`, (r) => (r.request().method() === 'GET' ? r.fulfill(jsonOk(lista)) : r.fallback()));
    await abrirTela(page, 'equipe');

    for (const [alvo, esperado] of [
      [TIAGO, { paga_hora_extra: true, valor_hora_extra: 25 }],
      [RAFAEL, { paga_hora_extra: false, valor_hora_extra: 40 }],
    ] as const) {
      await menuDe(page, alvo.nome);
      await page.getByRole('menuitem', { name: /Editar colaborador/ }).click();
      const d = page.getByRole('dialog', { name: 'Editar colaborador' });
      await d.getByLabel(/Telefone/).fill('(11) 97777-0000');
      await d.getByRole('button', { name: 'Salvar colaborador' }).click();
      await expect(d).toHaveCount(0);
      const e = (await ultimaEscrita(page))!;
      expect(e.metodo).toBe('PUT');
      expect(e.caminho).toBe(`/usuarios/${EMPRESA_ID}/${alvo.id}`);
      expect(e.corpo).toMatchObject(esperado);
    }
  });
});
