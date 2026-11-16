import type { Page, Route, Request } from '@playwright/test';
import {
  EMPRESA_ID,
  OS_BANCADA_ID,
  OS_FINALIZADA_ID,
  TOKEN_AVALIACAO,
  avaliacoes,
  configuracoesEmpresa,
  dashboard,
  dossie,
  empresa,
  escalas,
  financeiro,
  inteligencia,
  listaClientes,
  listaEstoque,
  listaOS,
  listaTransacoes,
  listaUsuarios,
  listaVeiculos,
  perfilDoCargo,
  pontos,
  usuarioPorId,
  usuarios,
  type Cenario,
} from './fixtures';
import { SUPABASE_URL, sessaoSupabase, usuarioDoToken } from './sessao';

export const API_URL = 'http://mock.api.local/api/v1';

export type Tela =
  | 'login'
  | 'radar'
  | 'ordens'
  | 'bancada'
  | 'clientes'
  | 'estoque'
  | 'financeiro'
  | 'equipe'
  | 'oficina'
  | 'avaliacao'
  | 'bancadaFinalizada';

export const TELAS: Tela[] = [
  'login',
  'radar',
  'ordens',
  'bancada',
  'clientes',
  'estoque',
  'financeiro',
  'equipe',
  'oficina',
  'avaliacao',
];

/** Caminho (relativo à raiz do app) de cada tela. Os valores de `tab` vêm de src/App.tsx. */
export const CAMINHO_DA_TELA: Record<Tela, string> = {
  login: '/',
  radar: '/?tab=patio',
  ordens: '/?tab=os',
  bancada: `/?tab=os&osId=${OS_BANCADA_ID}`,
  clientes: '/?tab=clientes',
  estoque: '/?tab=estoque',
  financeiro: '/?tab=financeiro',
  equipe: '/?tab=equipe',
  oficina: '/?tab=oficina',
  avaliacao: `/?modo=avaliar&token=${TOKEN_AVALIACAO}`,
  bancadaFinalizada: `/?tab=os&osId=${OS_FINALIZADA_ID}`,
};

// ------------------------------------------------------------------ estado por página
interface Estado {
  semFixture: string[];
  bloqueadas: string[];
  /** `user_metadata` acumulado pelas chamadas `PUT /auth/v1/user` (updateUser). */
  metaConta: Record<string, unknown>;
}
const estados = new WeakMap<Page, Estado>();

/** Requisições para a API/Supabase simulados que não têm fixture (cada uma deve reprovar o teste). */
export function rotasSemFixture(page: Page): string[] {
  return estados.get(page)?.semFixture ?? [];
}

/** Falha com a URL na mensagem se alguma rota ficou sem fixture. */
export function exigirRedeCompleta(page: Page): void {
  const faltando = rotasSemFixture(page);
  if (faltando.length > 0) {
    throw new Error(`Rota sem fixture no backend simulado:\n  ${faltando.join('\n  ')}`);
  }
}

/** Hosts cujo fracasso de carregamento (abortado de propósito) não conta como erro de console. */
export function urlIgnoradaNoConsole(url: string): boolean {
  if (!url) return false;
  const { origin } = new URL(url);
  return !(origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || url.startsWith(API_URL) || url.startsWith(SUPABASE_URL));
}

// ------------------------------------------------------------------ roteador da API
type Handler = (ctx: { m: RegExpMatchArray; q: URLSearchParams; cenario: Cenario; req: Request }) => unknown;

const GET: Array<[RegExp, Handler]> = [
  [/^\/usuarios\/me$/, ({ req }) => usuarioPorId(usuarioDoToken(req.headers()['authorization']) ?? '') ?? perfilDoCargo('DONO')],
  [/^\/empresas\/?$/, () => [empresa]],
  [/^\/empresas\/[^/]+\/configuracoes$/, () => configuracoesEmpresa],
  [/^\/usuarios\/[^/]+\/equipe$/, ({ cenario }) => listaUsuarios(cenario)],
  [/^\/usuarios\/[^/]+$/, ({ cenario }) => listaUsuarios(cenario)],
  [/^\/dashboards\/[^/]+$/, ({ cenario }) => dashboard(cenario)],
  [/^\/os\/?$/, ({ q, cenario }) => listaOS(cenario, q)],
  [/^\/os\/[^/]+\/([^/]+)\/imprimir$/, ({ m, cenario }) => dossie(cenario, m[1])],
  [/^\/clientes\/[^/]+$/, ({ cenario }) => listaClientes(cenario)],
  [/^\/veiculos\/consulta-placa\/[^/]+$/, () => ({ marca: 'Volkswagen', modelo: 'Gol 1.0', cor: 'Prata', ano: 2014, chassi: '9BWZZZ377VT004251' })],
  [/^\/veiculos\/[^/]+$/, ({ q, cenario }) => listaVeiculos(cenario, q.get('placa'))],
  [/^\/estoque\/[^/]+$/, ({ q, cenario }) => listaEstoque(cenario, q.get('categoria'))],
  [/^\/transacoes-financeiras\/[^/]+$/, ({ q, cenario }) => listaTransacoes(cenario, q)],
  [/^\/financeiro\/inteligencia\/[^/]+$/, ({ cenario }) => inteligencia(cenario)],
  [/^\/financeiro\/[^/]+$/, ({ cenario }) => financeiro(cenario)],
  [/^\/equipe\/escalas\/[^/]+$/, ({ cenario }) => escalas(cenario)],
  [/^\/equipe\/pontos\/[^/]+$/, ({ cenario }) => pontos(cenario)],
  [/^\/equipe\/avaliacoes\/[^/]+$/, ({ cenario }) => avaliacoes(cenario)],
  [/^\/equipe\/avaliacoes\/[^/]+\/link\/[^/]+$/, () => ({ token: TOKEN_AVALIACAO, caminho: `/?modo=avaliar&token=${TOKEN_AVALIACAO}` })],
  [/^\/equipe\/avaliar\/[^/]+$/, () => ({ veiculo_modelo: 'Fiat Argo 1.3', veiculo_placa: 'ABC1D23', ja_avaliada: false })],
];

const hosts = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/**
 * Intercepta TODA a rede da página. Nada chega ao Supabase nem ao backend reais:
 *  - app em localhost (Vite): passa direto;
 *  - Supabase Auth/REST e API da oficina: respondem com fixtures; escritas ecoam o corpo e
 *    guardam a última em `window.__ultimaEscrita`;
 *  - rota conhecida sem fixture: 599 + registro que `exigirRedeCompleta` transforma em falha;
 *  - qualquer outro host externo (CEP, fontes...): `abort()`.
 */
export async function simularBackend(page: Page, cenario: Cenario): Promise<void> {
  const estado: Estado = { semFixture: [], bloqueadas: [], metaConta: {} };
  estados.set(page, estado);

  const json = (route: Route, corpo: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      body: JSON.stringify(corpo),
    });

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    const u = hosts(url);
    if (!u) return route.continue();

    // app servido pelo Vite
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.fallback();

    const metodo = req.method();

    // preflight CORS
    if (metodo === 'OPTIONS' && (url.startsWith(SUPABASE_URL) || url.startsWith(API_URL))) {
      return json(route, {}, 204);
    }

    // ---- Supabase
    if (url.startsWith(SUPABASE_URL)) {
      const auth = req.headers()['authorization'];
      if (u.pathname.startsWith('/auth/v1/')) {
        const cargo = usuarioPorId(usuarioDoToken(auth) ?? '')?.cargo ?? 'DONO';
        const sessao = sessaoSupabase(cargo, estado.metaConta);
        if (u.pathname.endsWith('/user') && metodo === 'PUT') {
          // updateUser: mescla `data` em user_metadata (como o Supabase) e guarda a escrita
          let corpo: { data?: Record<string, unknown> } | null = null;
          try {
            corpo = req.postDataJSON();
          } catch {
            /* sem corpo */
          }
          await page
            .evaluate((c) => {
              const w = window as unknown as { __ultimaAuthUser: unknown; __escritasAuth: unknown[] };
              w.__ultimaAuthUser = c;
              (w.__escritasAuth ??= []).push(c);
            }, corpo)
            .catch(() => {});
          estado.metaConta = { ...estado.metaConta, ...(corpo?.data ?? {}) };
          return json(route, { ...sessao.user, user_metadata: { ...sessao.user.user_metadata, ...estado.metaConta } });
        }
        if (u.pathname.endsWith('/user')) return json(route, sessao.user);
        if (u.pathname.endsWith('/logout')) return json(route, {}, 204);
        return json(route, sessao); // token, signup...
      }
      if (u.pathname.startsWith('/rest/v1/usuarios')) {
        const id = u.searchParams.get('id')?.replace(/^eq\./, '');
        const perfil = (id && usuarioPorId(id)) || usuarioPorId(usuarioDoToken(auth) ?? '') || usuarios[0];
        const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        return json(route, objeto ? perfil : [perfil]);
      }
      estado.semFixture.push(`${metodo} ${url}`);
      return json(route, { message: `sem fixture: ${url}` }, 599);
    }

    // ---- API da oficina
    if (url.startsWith(API_URL)) {
      const caminho = u.pathname.replace(/^\/api\/v1/, '') || '/';

      if (metodo === 'GET') {
        for (const [re, h] of GET) {
          const m = caminho.match(re);
          if (m) return json(route, h({ m, q: u.searchParams, cenario, req }));
        }
        estado.semFixture.push(`GET ${url}`);
        return json(route, { detail: `sem fixture: ${url}` }, 599);
      }

      // escrita: ecoa o corpo (com um id) e guarda a última chamada
      let corpo: unknown = null;
      try {
        corpo = req.postDataJSON();
      } catch {
        /* sem corpo */
      }
      const registro = { metodo, url, caminho, corpo };
      await page.evaluate((r) => ((window as unknown as { __ultimaEscrita: unknown }).__ultimaEscrita = r), registro).catch(() => {});
      // ponto: o servidor decide usuário, data, hora e raio (aqui: dentro do raio, 08:15 de hoje)
      if (metodo === 'POST' && /^\/equipe\/pontos\/[^/]+$/.test(caminho)) {
        const c = (corpo ?? {}) as { tipo?: string; latitude?: number; longitude?: number };
        return json(route, { id: 'ponto-novo-0000', empresa_id: EMPRESA_ID, usuario_id: usuarios[3].id, usuario_nome: usuarios[3].nome, data: new Date().toLocaleDateString('sv-SE'), hora: '08:15:00', tipo: c.tipo, latitude: c.latitude, longitude: c.longitude, dentro_raio: true, distancia_metros: 0 });
      }
      // folha: o servidor soma salário + VT + VR dos ativos
      if (metodo === 'POST' && /^\/equipe\/folha\/[^/]+\/lancar-contas-a-pagar$/.test(caminho)) {
        const ativos = usuarios.filter((u) => u.ativo);
        const total = ativos.reduce((s, u) => s + (u.salario_base ?? 0) + (u.vale_transporte ?? 0) + (u.vale_refeicao ?? 0), 0);
        return json(route, { sucesso: true, total_funcionarios: ativos.length, valor_total_folha: total, transacao_id: 'folha-0000', mensagem: 'ok' });
      }
      const eco = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? { id: 'novo-id-0000', ...(corpo as object) } : (corpo ?? { status: 'ok', detail: 'ok' });
      return json(route, eco);
    }

    // ---- fontes do Google: seguem se a rede deixar, senão o app usa a fonte do sistema
    if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
      if (process.env.E2E_FONTES === '1') return route.continue();
      estado.bloqueadas.push(url);
      return route.abort();
    }

    // ---- qualquer outro host externo
    estado.bloqueadas.push(url);
    return route.abort();
  });
}

// ------------------------------------------------------------------ navegação
/**
 * Abre a tela e espera ela ficar pronta: `[data-tela-pronta]` (quando o app marcar) ou o `<h1>`,
 * depois a rede ociosa, sem spinners e com as fontes resolvidas.
 */
export async function abrirTela(page: Page, tela: Tela): Promise<void> {
  await page.goto(CAMINHO_DA_TELA[tela]);
  await page.locator('[data-tela-pronta], h1').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await page.locator('progress').first().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
