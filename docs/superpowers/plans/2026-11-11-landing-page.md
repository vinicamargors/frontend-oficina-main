# Landing mecanify.com.br Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing estática do Mecanify em `mecanify.com.br`, com hero 3D, recursos, prints, planos, SEO, consentimento LGPD e atalhos de contato, levando ao cadastro em `app.mecanify.com.br`.

**Architecture:** Repo novo `mecanify-site`, Astro com saída estática. Todo o conteúdo é HTML gerado no build; JS no cliente só em ilhas pequenas (toggle de planos, abas do tour, banner de cookies, hero 3D). Dados editáveis ficam em `src/site.config.ts`, IDs de rastreio em variáveis `PUBLIC_*`, textos legais em Markdown.

**Tech Stack:** Astro 5, Tailwind 3.4, TypeScript, Three.js (`three` 0.170+), Vitest, Playwright, `@lhci/cli`, `sharp` (conversão de prints), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-11-landing-page-design.md` (neste repo, `frontend-oficina-main`).

## Global Constraints

- Idioma pt-BR em todo texto; `<html lang="pt-BR">`.
- Tema escuro fixo: valores do bloco `.dark` de `src/styles/tokens.css` do sistema viram o `:root` da landing. Sem hex fixo em componentes.
- Fontes: `@fontsource-variable/geist` e `@fontsource-variable/geist-mono`, auto-hospedadas. Pesos 400/500/600, sem extrabold/black.
- Forma: cards `rounded-2xl` sem borda e sem sombra; controles `rounded-lg`; um botão âmbar primário por dobra.
- WCAG 2.2 AA: texto ≥ 4.5:1, alvos ≥ 44 px, foco visível âmbar de 3 px.
- Nunca citar: bot automático de status, multi-unidades, depoimentos, logos de clientes, números de uso.
- Selo do teste, texto exato: "30 dias grátis · sem cartão · sem fidelidade".
- CTA primário, texto exato: "Testar 30 dias grátis". Destino: `https://app.mecanify.com.br/?modo=cadastro` + `utm_*` da visita.
- Preços mensais: Bancada 97, Pátio Pro 197, Oficina Full 347. Anual por mês = `Math.floor(mensal * 10 / 12)` → 80, 164, 289.
- Nenhum script de GA4, Meta Pixel ou Google Ads carrega antes do consentimento da categoria.
- Variável `PUBLIC_*` vazia = ferramenta desligada, sem erro no console.
- Peso do 3D (código Three.js + texturas) ≤ 600 KB transferidos.
- Lighthouse mobile ≥ 95 em Performance, Acessibilidade, Boas práticas e SEO.

## Review Focus

1. **`localStorage` indisponível ou com JSON corrompido** (aba anônima, Safari bloqueado): banner aparece, nada quebra, escolha vale para a sessão. → teste na Task 4.
2. **Visitante revoga consentimento pelo rodapé depois de aceitar**: Consent Mode atualiza para `denied` e Pixel recebe `fbq('consent','revoke')`; nada novo é enviado. → teste na Task 4.
3. **URL com `utm_*` com acento, espaço ou `&`**, e parâmetros não-UTM (ex.: `gclid`, `fbclid`): UTMs e `gclid`/`fbclid` repassados, codificados; outros descartados. → teste na Task 2.
4. **JS desligado ou falha ao baixar o 3D**: imagem de fallback continua visível, CTAs funcionam, planos mostram valor mensal. → teste na Task 6.
5. **Perda de contexto WebGL / redimensionar ou girar o celular**: canvas some e o fallback volta; resize ajusta câmera sem distorcer. → teste na Task 6.

---

## Estrutura de arquivos

```
mecanify-site/
  astro.config.mjs            site, integrações (tailwind, sitemap), output static
  tailwind.config.mjs         tokens --c-* como cores (mesmo padrão do sistema)
  vercel.json                 redirect www → apex, headers de cache
  .env.example                PUBLIC_GA4_ID, PUBLIC_META_PIXEL_ID, PUBLIC_GOOGLE_ADS_ID, PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  README.md                   rodar, "Antes de publicar", regerar prints
  lighthouserc.json
  scripts/
    importar-prints.mjs       PNG do sistema → WebP/AVIF em src/assets/telas
    render-hero-fallback.mjs  screenshot do canvas 3D → public/hero/fallback.{avif,webp}
    checar-config.mjs         avisos de TODO_PREENCHER / IDs vazios no build
  src/
    site.config.ts            dados da empresa, contato, URLs, planos
    lib/
      precos.ts               precoAnualMensal()
      links.ts                linkCadastro(), linkWhatsApp(), linkEmail()
      consentimento.ts        estado e persistência do consentimento
      rastreio.ts             carrega tags conforme consentimento, track()
      dispositivo.ts          deveUsar3D()
    styles/tokens.css         tokens escuros + base
    layouts/Base.astro        <head> SEO, fontes, Header, Footer, WhatsApp, Banner
    components/
      Seo.astro  JsonLd.astro  Header.astro  Footer.astro  WhatsAppFlutuante.astro
      BannerCookies.astro     markup + script da ilha
      Botao.astro  SeloTeste.astro
      home/  Hero.astro  Hero3D.ts  Dores.astro  Recursos.astro  Tour.astro
             Planos.astro  ComoFuncionaTeste.astro  Faq.astro  CtaFinal.astro
    content/
      config.ts               coleção "legal"
      legal/privacidade.md  termos.md  cookies.md
    pages/
      index.astro  privacidade.astro  termos.astro  cookies.astro  404.astro
      robots.txt.ts
    assets/telas/             prints convertidos
  public/  favicon.svg  logo.svg  og.png  hero/
  tests/unit/  precos.test.ts  links.test.ts  consentimento.test.ts  contraste.test.ts  dispositivo.test.ts
  e2e/  playwright.config.ts  navegacao.spec.ts  cookies.spec.ts  hero.spec.ts  planos.spec.ts  seo.spec.ts
  .github/workflows/ci.yml
```

---

### Task 0: Repositório

Pré-requisito do usuário: repo `mecanify-site` vazio no GitHub. O executor anexa com `add_repo` (access `push`) e clona.

- [ ] **Step 1:** `add_repo` owner `vinicamargors`, repo `mecanify-site`, access `push`; clonar em `/home/user/mecanify-site`; criar branch de trabalho.

---

### Task 1: Esqueleto, tokens e contraste

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tailwind.config.mjs`, `tsconfig.json`, `src/styles/tokens.css`, `src/pages/index.astro` (placeholder com `h1`), `tests/unit/contraste.test.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `vercel.json`

**Interfaces:**
- Produces: classes Tailwind `bg|text|ring-<token>` para `canvas surface muted sunken line line-strong ink ink-muted ink-subtle brand brand-hover brand-ink on-brand`; scripts npm `dev`, `build`, `preview`, `test`, `e2e`.

- [ ] **Step 1: Portar o teste de contraste**

Copiar `tests/unit/contraste.test.ts` do sistema, lendo `src/styles/tokens.css` da landing e só o bloco `:root`. Pares que devem passar: `ink`, `ink-muted`, `ink-subtle`, `brand-ink` sobre `canvas` e `surface` ≥ 4.5; `on-brand` sobre `brand` ≥ 4.5; `line-strong` sobre `sunken` ≥ 3.

- [ ] **Step 2:** `npx vitest run tests/unit/contraste.test.ts` → FAIL (arquivo de tokens não existe).

- [ ] **Step 3: Criar o projeto**

`npm create astro@latest` (template minimal, TS strict), `@astrojs/tailwind`, `@astrojs/sitemap`, `tailwindcss@3`, fontes Geist. `astro.config.mjs`: `site: 'https://mecanify.com.br'`, `output: 'static'`, `trailingSlash: 'never'`. `tokens.css`: `:root` = valores do `.dark` do sistema; `color-scheme: dark`; foco global `outline: 3px solid rgb(var(--c-brand))`. `tailwind.config.mjs` mapeia cada token como `rgb(var(--c-x) / <alpha-value>)`. `vercel.json`: redirect 301 de `www.mecanify.com.br/:path*` para `https://mecanify.com.br/:path*`; `Cache-Control: public, max-age=31536000, immutable` para `/_astro/*`. `.env.example` com as 4 variáveis vazias.

- [ ] **Step 4:** `npm test` → PASS. `npm run build` → sem erro.

- [ ] **Step 5:** Commit `chore: esqueleto Astro com tokens Grafite + Âmbar`.

---

### Task 2: Configuração do site, preços e links

**Files:**
- Create: `src/site.config.ts`, `src/lib/precos.ts`, `src/lib/links.ts`, `scripts/checar-config.mjs`, `tests/unit/precos.test.ts`, `tests/unit/links.test.ts`
- Modify: `package.json` (`"build": "node scripts/checar-config.mjs && astro build"`), `README.md`

**Interfaces:**
- Produces:
  - `site: SiteConfig` com `empresa: { razaoSocial, cnpj }`, `contato: { whatsapp /* só dígitos, com 55 */, mensagemWhatsApp, email, assuntoEmail }`, `urls: { app: 'https://app.mecanify.com.br/', cadastro: 'https://app.mecanify.com.br/?modo=cadastro', site: 'https://mecanify.com.br' }`, `planos: Plano[]`.
  - `type Plano = { id: 'bancada' | 'patio-pro' | 'oficina-full'; nome: string; paraQuem: string; mensal: number; usuarios: string; itens: string[]; destaque: boolean }`
  - `precoAnualMensal(mensal: number): number`
  - `linkCadastro(busca: string, base?: string): string` — `busca` é `location.search`
  - `linkWhatsApp(numero: string, mensagem: string): string`
  - `linkEmail(email: string, assunto: string): string`
  - Placeholders: string literal `TODO_PREENCHER`.

- [ ] **Step 1: Testes**

```ts
// precos.test.ts
expect([97, 197, 347].map(precoAnualMensal)).toEqual([80, 164, 289]);
// links.test.ts
expect(linkCadastro('')).toBe('https://app.mecanify.com.br/?modo=cadastro');
expect(linkCadastro('?utm_source=google&utm_campaign=revisão de férias&x=1&gclid=abc'))
  .toBe('https://app.mecanify.com.br/?modo=cadastro&utm_source=google&utm_campaign=revis%C3%A3o+de+f%C3%A9rias&gclid=abc');
expect(linkCadastro('?utm_term=a%26b')).toContain('utm_term=a%26b');
expect(linkWhatsApp('5511999999999', 'Olá, quero conhecer o Mecanify'))
  .toBe('https://wa.me/5511999999999?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20Mecanify');
expect(linkEmail('contato@x.com', 'Quero conhecer o Mecanify'))
  .toBe('mailto:contato@x.com?subject=Quero%20conhecer%20o%20Mecanify');
```

Parâmetros repassados: `utm_source utm_medium utm_campaign utm_term utm_content gclid fbclid`, nessa ordem.

- [ ] **Step 2:** `npm test` → FAIL.

- [ ] **Step 3: Implementar** `precos.ts`, `links.ts` (`URLSearchParams` para montar a query) e `site.config.ts` com os planos da seção 6 da spec. Itens por plano (texto exato):
  - Bancada: "1 usuário (dono)", "Clientes e veículos", "Ordens de serviço e pátio", "Orçamento pelo WhatsApp e PIX na OS".
  - Pátio Pro: "Até 5 usuários", "Tudo do Bancada", "Estoque com baixa na OS", "Caixa, contas e DRE", "Perfis por cargo: mecânico não vê o financeiro", "Equipe e RH: ponto e holerite".
  - Oficina Full: "Usuários ilimitados", "Tudo do Pátio Pro", "Auditoria: quem mexeu em cada OS e peça", "Suporte prioritário".

  `checar-config.mjs`: lê `site.config.ts` como texto e `process.env`; imprime `⚠ Antes de publicar:` + lista de cada `TODO_PREENCHER` e `PUBLIC_*` vazia; sempre sai com código 0.

  `README.md`: seção "Antes de publicar" com tabela item → onde editar → exemplo (contato/CNPJ → `src/site.config.ts`; IDs → variáveis na Vercel; textos legais → `src/content/legal/*.md` + `revisado: true`; DNS).

- [ ] **Step 4:** `npm test` → PASS. `npm run build` → imprime avisos e termina com sucesso.

- [ ] **Step 5:** Commit `feat: config do site, preços anuais e links de cadastro/contato`.

---

### Task 3: Layout base, SEO, header, rodapé e WhatsApp

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/{Seo,JsonLd,Header,Footer,WhatsAppFlutuante,Botao,SeloTeste}.astro`, `src/pages/robots.txt.ts`, `src/pages/404.astro`, `public/{favicon.svg,logo.svg,og.png}`, `e2e/playwright.config.ts`, `e2e/seo.spec.ts`, `e2e/navegacao.spec.ts`

**Interfaces:**
- Consumes: `site`, `linkCadastro`, `linkWhatsApp`, `linkEmail` (Task 2).
- Produces:
  - `<Base titulo: string descricao: string caminho: string jsonLd?: object[]>` — slot para o conteúdo.
  - `<Botao href variante: 'primario' | 'secundario' | 'fantasma' origem?: string>` — `origem` vira `data-cta-origem` (usado pela Task 8).
  - Todo link de cadastro tem `data-cta="cadastro"` e `href` inicial `site.urls.cadastro`; um script inline curto reescreve com `linkCadastro(location.search)` ao carregar.
  - Link do rodapé `#preferencias-cookies` com `data-abrir-cookies` (Task 4 escuta).

- [ ] **Step 1: Testes e2e** (Playwright contra `astro preview`, projeto mobile 390 e desktop 1440)

  `seo.spec.ts`, na home: um único `h1`; `title` contém "Mecanify"; `meta[name=description]` não vazio; `link[rel=canonical]` = `https://mecanify.com.br/`; `og:image` absoluto; JSON-LD parseável com `@type` `Organization`. `/robots.txt` contém `Sitemap: https://mecanify.com.br/sitemap-index.xml`. `/nao-existe` retorna 404 com link para a home.

  `navegacao.spec.ts`: `/?utm_source=ig` → todos `[data-cta=cadastro]` têm `href` contendo `modo=cadastro&utm_source=ig`; botão WhatsApp flutuante visível com `href` começando por `https://wa.me/`; link de e-mail no rodapé começa por `mailto:`; rodapé mostra razão social e CNPJ de `site.config.ts`; header "Entrar" aponta para `https://app.mecanify.com.br/`; todos os alvos clicáveis do header ≥ 44 px de altura no mobile.

- [ ] **Step 2:** `npm run e2e` → FAIL.

- [ ] **Step 3: Implementar.** Logo: copiar `public/logo.svg` e `favicon.svg` do sistema. `og.png` 1200×630: logo + "Sistema para oficina mecânica" sobre `canvas`. Header fixo com âncoras `#recursos #telas #planos #duvidas`. Botão WhatsApp: canto inferior direito, 56 px, `aria-label="Falar no WhatsApp"`, acima do banner de cookies quando ele está aberto. `Seo.astro` gera title, description, canonical, OG, Twitter card.

- [ ] **Step 4:** `npm run e2e` → PASS.

- [ ] **Step 5:** Commit `feat: layout base com SEO, header, rodapé e WhatsApp`.

---

### Task 4: Consentimento LGPD e carregamento de tags

**Files:**
- Create: `src/lib/consentimento.ts`, `src/lib/rastreio.ts`, `src/components/BannerCookies.astro`, `tests/unit/consentimento.test.ts`, `e2e/cookies.spec.ts`
- Modify: `src/layouts/Base.astro` (snippet de Consent Mode no `<head>`, antes de qualquer tag)

**Interfaces:**
- Produces:
  - `type Consentimento = { analytics: boolean; marketing: boolean; versao: number; em: number }` (`em` = epoch ms)
  - `VERSAO_POLITICA = 1`, `VALIDADE_MS = 365 * 24 * 3600 * 1000`, chave `localStorage` `mecanify_consentimento`
  - `lerConsentimento(agora?: number): Consentimento | null` — `null` se ausente, inválido, versão diferente, vencido, ou `localStorage` lança
  - `salvarConsentimento(c: Omit<Consentimento,'versao'|'em'>, agora?: number): Consentimento` — guarda em memória se `localStorage` falhar
  - `aplicarConsentimento(c: Consentimento): void` — em `rastreio.ts`: `gtag('consent','update', …)`; carrega GA4 se `analytics` e `PUBLIC_GA4_ID`; carrega Pixel e Ads se `marketing` e o ID existir; com `marketing=false` após Pixel carregado chama `fbq('consent','revoke')`. Nunca injeta o mesmo script duas vezes.
  - `track(evento: string, params?: Record<string,string>): void` — no-op se nada carregado.

- [ ] **Step 1: Testes unitários** (`vitest` com `jsdom`)
  - sem nada salvo → `null`
  - salvar `{analytics:true, marketing:false}` → ler devolve o mesmo com `versao: 1`
  - `em` de 366 dias atrás → `null`
  - `versao: 0` salvo → `null`
  - valor `"{quebrado"` → `null`
  - `localStorage.getItem` lança → `lerConsentimento()` devolve `null` sem lançar; `salvarConsentimento` não lança e a leitura seguinte na mesma página devolve o valor salvo

- [ ] **Step 2: Testes e2e** (`cookies.spec.ts`, IDs de teste via env no `astro build` do config do Playwright: `G-TESTE`, `000TESTE`, `AW-TESTE`; rotas externas interceptadas com `page.route` respondendo vazio)
  - primeira visita: banner visível com "Aceitar", "Recusar", "Personalizar"; nenhuma requisição para `googletagmanager.com` nem `connect.facebook.net`
  - "Recusar" → banner some; recarregar → banner não volta; nenhuma requisição às tags
  - "Personalizar" → só Analytics → requisição a `gtag/js?id=G-TESTE`; nenhuma a `facebook`
  - "Aceitar" → GA4, Pixel e `gtag/js?id=AW-TESTE` requisitados
  - depois de aceitar, rodapé "Preferências de cookies" → desmarcar Marketing → `window.dataLayer` recebe `consent update` com `ad_storage: 'denied'`; `fbq` chamado com `('consent','revoke')`
  - build sem `PUBLIC_GA4_ID` + "Aceitar" → nenhuma requisição a `gtag/js?id=G-` e console sem erro
  - banner operável só por teclado; foco vai para o banner ao abrir pelo rodapé

- [ ] **Step 3:** `npm test && npm run e2e -- cookies` → FAIL.

- [ ] **Step 4: Implementar.** Snippet no `<head>`: define `dataLayer`, `gtag`, e `gtag('consent','default', {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', wait_for_update: 500})`. Banner: barra fixa no rodapé, `role="dialog"` `aria-label="Cookies"`, link para `/cookies`. Vercel Analytics via `<script defer src="/_vercel/insights/script.js">` sempre.

- [ ] **Step 5:** testes → PASS.

- [ ] **Step 6:** Commit `feat: banner LGPD com Consent Mode v2 e carregamento condicional de GA4, Pixel e Ads`.

---

### Task 5: Prints do sistema e seções estáticas da home

**Files:**
- Create: `scripts/importar-prints.mjs`, `src/assets/telas/*`, `src/components/home/{Hero,Dores,Recursos,Tour,Planos,ComoFuncionaTeste,Faq,CtaFinal}.astro`, `e2e/planos.spec.ts`
- Modify: `src/pages/index.astro`, `README.md` (seção "Regerar prints")

**Interfaces:**
- Consumes: `site.planos`, `precoAnualMensal`, `<Botao>`, `<SeloTeste>`, `<Base jsonLd>`.
- Produces:
  - `Hero.astro` renderiza `<picture id="hero-fallback">` com `public/hero/fallback.{avif,webp}` (placeholder até a Task 6) e um `<div id="hero-3d" aria-hidden="true">` vazio.
  - Imagens em `src/assets/telas/<tela>-<largura>.{avif,webp}`, telas: `radar ordens estoque financeiro equipe`, larguras `1440 390`.

- [ ] **Step 1: Prints.** No repo do sistema: `PRINTS_DIR=prints/landing npx playwright test -c e2e/playwright.config.ts e2e/prints.spec.ts --project=escuro-1440 --project=escuro-390 --grep "cheio"`. `importar-prints.mjs <pasta>` lê `<tela>-escuro-<largura>-cheio.png` e grava AVIF (q 55) e WebP (q 75) em `src/assets/telas/` com `sharp`. Conferir visualmente: nenhum nome de cliente real.

- [ ] **Step 2: Teste e2e** (`planos.spec.ts`)
  - padrão "Mensal": cards mostram `R$ 97`, `R$ 197`, `R$ 347`
  - clicar "Anual" → `R$ 80`, `R$ 164`, `R$ 289` e texto "2 meses grátis"
  - toggle é `role="radiogroup"`, operável com setas
  - Pátio Pro tem etiqueta "Mais escolhido"
  - nenhum texto da página contém "bot", "multi-unidade" ou "multiunidade" (case-insensitive)
  - com `javaScriptEnabled: false`: valores mensais visíveis, abas do tour mostram a primeira tela, CTAs têm `href` de cadastro
  - abas do tour: `role="tablist"`, setas trocam a aba e a imagem
  - JSON-LD da home contém `SoftwareApplication` com 3 `offers` (`price` 97, 197, 347, `priceCurrency` BRL) e `FAQPage`

- [ ] **Step 3:** `npm run e2e -- planos` → FAIL.

- [ ] **Step 4: Implementar as seções** na ordem da seção 3 da spec, com âncoras `recursos`, `telas`, `planos`, `duvidas`. Imagens via `<Image>`/`<Picture>` do Astro com `width/height` e `loading="lazy"` (fora do hero). Copy:
  - `h1`: "Sistema para oficina mecânica que cabe no ritmo do pátio"
  - subtítulo: "Ordens de serviço, pátio, estoque, caixa e equipe em um só lugar. No computador do balcão ou no celular, com a mão suja de graxa."
  - Dores (3 cards): "OS no papel some, rasga e não diz o que está parado." / "Cliente liga toda hora perguntando se o carro está pronto." / "Peça usada que ninguém lembrou de cobrar."
  - Recursos: um card por item da seção 3.4 da spec, título curto + 1 frase + print.
  - Como funciona o teste: "Crie a conta em 1 minuto", "Use tudo do Pátio Pro por 30 dias", "Escolha o plano. Se não escolher, seus dados continuam lá."
  - FAQ (pergunta → resposta curta): cartão (não pede), cancelar (a qualquer momento, sem multa), dados (nunca apagados ao fim do teste; acesso para consulta), celular (sim, feito para celular), migrar do papel/planilha (cadastro de cliente e veículo pela placa; falar no WhatsApp para ajuda), usuários (1, até 5, ilimitados por plano).
  - CTA final: "Seu pátio organizado ainda esta semana." + botão primário + selo.

- [ ] **Step 5:** `npm run e2e` → PASS.

- [ ] **Step 6:** Commit `feat: seções da home com prints, planos com toggle anual e FAQ`.

---

### Task 6: Hero 3D

**Files:**
- Create: `src/components/home/Hero3D.ts`, `src/lib/dispositivo.ts`, `scripts/render-hero-fallback.mjs`, `public/hero/fallback.{avif,webp}`, `tests/unit/dispositivo.test.ts`, `e2e/hero.spec.ts`
- Modify: `src/components/home/Hero.astro`

**Interfaces:**
- Consumes: `#hero-3d`, `#hero-fallback` (Task 5); `radar-1440` e `radar-390` como texturas.
- Produces:
  - `deveUsar3D(amb: { webgl: boolean; reduzMovimento: boolean; nucleos?: number; memoriaGb?: number }): boolean` — `false` se sem WebGL, reduz movimento, `nucleos <= 4` ou `memoriaGb <= 4`; campos ausentes não bloqueiam.
  - `montarHero(alvo: HTMLElement, texturas: { desktop: string; mobile: string }): () => void` — devolve função de desmontagem.

**Decisão do plano:** os aparelhos são **geometria procedural** em Three.js (`RoundedBoxGeometry` para corpo e tela, plano com a textura do print), não arquivos GLB. Cumpre "low-poly, próprio, ≤ 600 KB" sem modelo externo nem licença. Se o resultado visual não agradar, trocar por GLB fica isolado em `montarHero`.

- [ ] **Step 1: Testes unitários** de `deveUsar3D`: tudo bom → `true`; `webgl:false` → `false`; `reduzMovimento:true` → `false`; `nucleos:4` → `false`; `memoriaGb:2` → `false`; `nucleos` ausente e `memoriaGb` ausente → `true`.

- [ ] **Step 2: Testes e2e** (`hero.spec.ts`)
  - desktop padrão: após `networkidle`, existe `#hero-3d canvas` e `#hero-fallback` ganha `data-oculto`
  - `reducedMotion: 'reduce'` → sem canvas, fallback visível
  - `HTMLCanvasElement.prototype.getContext` sobrescrito para devolver `null` (via `addInitScript`) → sem canvas, fallback visível, console sem erro
  - disparar `webglcontextlost` no canvas → canvas removido, fallback visível
  - viewport 390×844 → 844×390: canvas com `width/height` do container e sem erro
  - `javaScriptEnabled: false` → fallback visível
  - soma de bytes transferidos de `three` + texturas do hero ≤ 600 000

- [ ] **Step 3:** testes → FAIL.

- [ ] **Step 4: Implementar.** Ilha carregada por `<script>` com `IntersectionObserver` + `import('./Hero3D')` só se `deveUsar3D(...)`. Cena: notebook aberto à esquerda, celular em pé à frente à direita, luz âmbar de contorno, fundo transparente. Movimento: inclinação máxima ±6° seguindo o ponteiro; rotação Y de até 10° ligada ao progresso de scroll do hero. Loop com `requestAnimationFrame` pausado quando o hero sai da viewport (`IntersectionObserver`) ou a aba fica oculta. `devicePixelRatio` limitado a 2. Fallback só é ocultado após o primeiro frame renderizado. Importar só os módulos usados de `three` (tree-shaking).

- [ ] **Step 5: Fallback.** `render-hero-fallback.mjs`: sobe `astro preview`, abre a home 1440 px com `?render-fallback=1` (força 3D, fundo transparente, câmera na pose inicial), screenshot do canvas, grava `public/hero/fallback.avif` e `.webp` com `sharp`. Rodar e commitar as imagens.

- [ ] **Step 6:** testes → PASS.

- [ ] **Step 7:** Commit `feat: hero 3D com notebook e celular, fallback estático`.

---

### Task 7: Páginas legais

**Files:**
- Create: `src/content/config.ts`, `src/content/legal/{privacidade,termos,cookies}.md`, `src/pages/{privacidade,termos,cookies}.astro`, `src/components/AvisoRascunho.astro`
- Modify: `e2e/navegacao.spec.ts`

**Interfaces:**
- Consumes: `site.empresa`, `site.contato`, `<Base>`.
- Produces: coleção `legal` com schema `{ titulo: string; atualizadoEm: date; revisado: boolean (default false) }`. Marcadores no corpo `{{razaoSocial}}`, `{{cnpj}}`, `{{email}}` substituídos no render a partir de `site.config.ts`.

- [ ] **Step 1: Teste e2e:** cada página legal abre, tem `h1` com o `titulo`, mostra "Rascunho — revisão jurídica pendente" enquanto `revisado: false`, contém o CNPJ de `site.config.ts` e nenhum `{{`. Com um `.md` de fixture `revisado: true` (teste de build separado ou unitário da função de render) → sem aviso.

- [ ] **Step 2:** → FAIL.

- [ ] **Step 3: Implementar e redigir os rascunhos.** Privacidade: controlador, dados coletados (navegação via GA4/Vercel Analytics, cookies de marketing via Meta Pixel e Google Ads, cliques em contato; nenhum formulário), finalidades, bases legais LGPD (consentimento art. 7º I; legítimo interesse para métricas sem cookie), compartilhamento (Google, Meta, Vercel), direitos do titular, contato. Cookies: tabela por categoria (necessários, analytics, marketing) com nomes `_ga`, `_ga_*`, `_fbp`, `_gcl_au`, finalidade e duração; como mudar a escolha. Termos: uso do site, teste de 30 dias sem cartão e sem fidelidade, preços sujeitos a alteração com aviso, foro.

- [ ] **Step 4:** → PASS.

- [ ] **Step 5:** Commit `feat: páginas legais em Markdown com aviso de rascunho`.

---

### Task 8: Eventos de conversão

**Files:**
- Modify: `src/lib/rastreio.ts`, `src/layouts/Base.astro`, `src/components/home/Planos.astro`, `e2e/cookies.spec.ts`

**Interfaces:**
- Consumes: `track()` (Task 4), `data-cta`, `data-cta-origem` (Task 3).
- Produces: eventos `cta_cadastro {origem}`, `cta_entrar`, `whatsapp_click`, `email_click`, `plano_toggle_anual`. `cta_cadastro` também dispara conversão do Google Ads (`send_to: PUBLIC_GOOGLE_ADS_ID/PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`) e `fbq('track','Lead')` quando Marketing aceito.

- [ ] **Step 1: Teste e2e:** após "Aceitar", clicar no CTA do hero → `window.dataLayer` contém `['event','cta_cadastro',{origem:'hero'}]` (interceptar a navegação com `page.route` para não sair da página); clicar WhatsApp → `whatsapp_click`; toggle anual → `plano_toggle_anual`. Sem consentimento → nenhum desses entra no `dataLayer` como evento.

- [ ] **Step 2:** → FAIL.

- [ ] **Step 3: Implementar** com um único listener de clique delegado no `document` (`data-cta`, `data-evento`). Origens: `header`, `hero`, `planos-bancada`, `planos-patio-pro`, `planos-oficina-full`, `cta-final`.

- [ ] **Step 4:** → PASS.

- [ ] **Step 5:** Commit `feat: eventos de conversão`.

---

### Task 9: CI, Lighthouse e verificação final

**Files:**
- Create: `.github/workflows/ci.yml`, `lighthouserc.json`
- Modify: `README.md`

- [ ] **Step 1:** `lighthouserc.json`: URLs `/`, `/privacidade`; preset mobile; asserções `categories:performance|accessibility|best-practices|seo` `minScore: 0.95`.

- [ ] **Step 2:** `ci.yml` em PR e push na `main`: `npm ci`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, `npm run e2e`, `npx lhci autorun`.

- [ ] **Step 3:** Rodar local: `npm test && npm run build && npm run e2e && npx lhci autorun` → tudo verde. Se Performance < 95, ajustar (preload da fonte, prioridade da imagem do hero, adiar 3D) até passar.

- [ ] **Step 4:** Revisão visual: screenshots 1440 e 390 de cada página (`deviceScaleFactor: 2`) enviados ao usuário.

- [ ] **Step 5:** Commit `ci: testes, e2e e Lighthouse no PR`; push.
