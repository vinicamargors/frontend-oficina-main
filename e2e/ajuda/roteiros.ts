import type { Page } from '@playwright/test';
import { abrirTela } from '../mocks';

/** Tira o print do passo `n` do guia e mede a caixa (em % da imagem) de cada alvo `data-tour`. */
export type Foto = (n: number, alvos: string[]) => Promise<void>;

const dados = async (page: Page, alvo: string) => {
  const caixa = await page
    .locator(`[data-tour="${alvo}"]`)
    .evaluateAll((els) => {
      const el = els.find((e) => e.getBoundingClientRect().width > 0) as HTMLElement | undefined;
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  return caixa;
};
export { dados as medirAlvo };

type Roteiro = (page: Page, foto: Foto) => Promise<void>;

export const ROTEIROS: Record<string, Roteiro> = {
  'abrir-os': async (page, foto) => {
    await abrirTela(page, 'ordens');
    await foto(2, ['ordens-nova']);
  },
  'orcamento-whatsapp': async (page, foto) => {
    await abrirTela(page, 'bancada');
    await foto(2, ['os-lancar-item']);
    await foto(5, ['os-whatsapp']);
  },
  'mover-etapa': async (page, foto) => {
    await page.addInitScript(() => localStorage.setItem('mecanify_radar_periodo', '30'));
    await abrirTela(page, 'radar');
    await foto(2, ['radar-quadro']);
    await abrirTela(page, 'ordens');
    await foto(4, ['ordens-lista']);
  },
  'receber-pagamento': async (page, foto) => {
    await abrirTela(page, 'ordens');
    await page.getByRole('button', { name: /^Finalizado/ }).click();
    await page.getByRole('button', { name: /Receber \/ dar baixa/ }).first().click();
    await page.getByRole('button', { name: 'Confirmar pagamento' }).waitFor();
    await foto(5, ['pagamento-confirmar']);
  },
  'cliente-veiculo': async (page, foto) => {
    await abrirTela(page, 'clientes');
    await foto(2, ['clientes-novo']);
    await page.getByRole('button', { name: /Novo cliente/ }).click();
    await page.locator('[data-tour="cliente-nome"]').waitFor();
    await foto(3, ['cliente-nome']);
  },
  'ajustar-estoque': async (page, foto) => {
    await abrirTela(page, 'estoque');
    await foto(1, ['estoque-categorias']);
    await page.getByRole('button', { name: /^Mais ações de/ }).first().click();
    await page.getByRole('menuitem', { name: 'Registrar entrada' }).first().waitFor();
    await foto(3, ['estoque-lista']);
  },
  'equipe-colaborador': async (page, foto) => {
    await abrirTela(page, 'equipe');
    await foto(2, ['equipe-novo']);
    await foto(5, ['equipe-convidar']);
  },
  'equipe-folha': async (page, foto) => {
    await abrirTela(page, 'equipe');
    await foto(1, ['equipe-abas']);
  },
  'oficina-dados': async (page, foto) => {
    await abrirTela(page, 'oficina');
    await foto(4, ['oficina-pix']);
  },
  'conta-baixa': async (page, foto) => {
    await abrirTela(page, 'financeiro');
    await foto(2, ['financeiro-novo']);
    await page.getByRole('tab', { name: /Contas/ }).click();
    await page.locator('[data-tour="financeiro-baixa"]').first().waitFor();
    await foto(5, ['financeiro-baixa']);
  },
};
