import { expect, test } from '@playwright/test';
import { abrirTela, entrarComo, simularBackend, type Tela } from './mocks';
import { contextoDoProjeto } from './contexto';
import { TOUR_RADAR } from '../src/tour/passos/radar';
import { TOUR_ORDENS } from '../src/tour/passos/ordens';
import { TOUR_CLIENTES } from '../src/tour/passos/clientes';
import { TOUR_ESTOQUE } from '../src/tour/passos/estoque';
import { TOUR_FINANCEIRO } from '../src/tour/passos/financeiro';
import { TOUR_EQUIPE } from '../src/tour/passos/equipe';
import { TOUR_OFICINA } from '../src/tour/passos/oficina';
import { TOUR_BANCADA } from '../src/tour/passos/bancada';
import type { TourDef } from '../src/tour/tipos';

type Cargo = 'DONO' | 'ATENDENTE' | 'MECANICO' | 'FINANCEIRO';
const TOURS: { tela: Tela; def: TourDef; cargos: Cargo[] }[] = [
  { tela: 'radar', def: TOUR_RADAR, cargos: ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO'] },
  { tela: 'ordens', def: TOUR_ORDENS, cargos: ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO'] },
  { tela: 'clientes', def: TOUR_CLIENTES, cargos: ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO'] },
  { tela: 'estoque', def: TOUR_ESTOQUE, cargos: ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO'] },
  { tela: 'financeiro', def: TOUR_FINANCEIRO, cargos: ['DONO', 'FINANCEIRO'] },
  { tela: 'equipe', def: TOUR_EQUIPE, cargos: ['DONO'] },
  { tela: 'oficina', def: TOUR_OFICINA, cargos: ['DONO'] },
  { tela: 'bancada', def: TOUR_BANCADA, cargos: ['DONO', 'ATENDENTE', 'MECANICO', 'FINANCEIRO'] },
];

for (const { tela, def, cargos } of TOURS) {
  for (const cargo of cargos) {
    test(`tour ${def.id} (${cargo}): cada passo não opcional tem alvo visível e o cartão percorre os passos`, async ({ page }, info) => {
      const { tema } = contextoDoProjeto(info);
      await simularBackend(page, 'cheio');
      await entrarComo(page, cargo, tema, { tourAtivo: true });
      await abrirTela(page, tela);
      const cartao = page.getByRole('dialog').filter({ hasText: /Passo \d de \d/ });
      await expect(cartao).toBeVisible();
      for (const p of def.passos.filter((x) => !x.opcional)) {
        const alvo = page.locator(`[data-tour="${p.alvo}"]`);
        const n = await alvo.count();
        expect(n, `alvo ${p.alvo} não existe`).toBeGreaterThan(0);
        let algumVisivel = false;
        for (let k = 0; k < n; k++) if (await alvo.nth(k).evaluate((el) => el.getBoundingClientRect().width > 0)) algumVisivel = true;
        expect(algumVisivel, `alvo ${p.alvo} sem tamanho`).toBe(true);
      }
      // percorre: o título de cada passo exibido pertence ao tour e o último fecha
      const titulos = def.passos.map((p) => p.titulo);
      for (let n = 0; n < def.passos.length; n++) {
        const titulo = await cartao.getByRole('heading').innerText();
        expect(titulos).toContain(titulo);
        const proximo = cartao.getByRole('button', { name: 'Próximo' });
        if (await proximo.count()) await proximo.click();
        else break;
      }
      await cartao.getByRole('button', { name: 'Concluir' }).click();
      await expect(cartao).toHaveCount(0);
    });
  }
}
