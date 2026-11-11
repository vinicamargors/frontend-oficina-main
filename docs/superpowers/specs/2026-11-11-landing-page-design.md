# Landing page mecanify.com.br — Design

Data: 2026-11-11. Status: aprovado.

## 1. Objetivo

Página pública de venda do Mecanify em `mecanify.com.br`.

- **Ação principal:** criar conta grátis (teste de 30 dias).
- **Público:** dono de oficina mecânica (solo até centro automotivo).
- **Sucesso:** visitante entende o produto em segundos e clica em "Testar 30 dias grátis".
- **Idioma:** pt-BR.

### Regras de conteúdo

- Só prometer o que existe hoje. **Fora:** bot automático de status e multi-unidades.
- Auditoria/logs: existe no backend, pode ser divulgada (plano Full).
- Sem depoimentos, logos de clientes ou números de uso inventados.
- Prints só com dados simulados (nunca dados da Autotec Racing ou outro cliente real).

## 2. Arquitetura

- **Repo novo:** `mecanify-site` (separado do sistema).
- **Stack:** Astro (saída estática) + Tailwind 3 + TypeScript. Three.js só na ilha do hero.
- **Hospedagem:** Vercel.
  - `mecanify.com.br` (e `www` → redirect 301 para o apex) → landing.
  - `app.mecanify.com.br` → sistema atual.
- **Identidade:** tokens Grafite + Âmbar e fontes Geist / Geist Mono copiados de `src/styles/tokens.css` e `DESIGN.md` deste repo. **Tema escuro fixo.**
- **Configuração fácil (sem mexer em componente):**
  - `src/site.config.ts` — único arquivo com dados da empresa e do produto: WhatsApp, mensagem padrão do WhatsApp, e-mail, CNPJ, razão social, URL do app e do cadastro, preços dos planos. Placeholders marcados com `TODO_PREENCHER`.
  - **IDs de rastreio por variável de ambiente** (painel da Vercel ou `.env`): `PUBLIC_GA4_ID`, `PUBLIC_META_PIXEL_ID`, `PUBLIC_GOOGLE_ADS_ID`, `PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`. Vazia = ferramenta desligada, sem erro.
  - `.env.example` lista todas as variáveis.
  - `README.md` com seção "Antes de publicar": tabela de cada item, onde editar e exemplo.
  - Build de produção emite **aviso** (não falha) se algum `TODO_PREENCHER` ou ID estiver vazio.
- **Rotas:** `/`, `/privacidade`, `/termos`, `/cookies`, `404`.

### CTA

- Destino: `https://app.mecanify.com.br/?modo=cadastro` (modo já suportado em `src/pages/Login.tsx`).
- Parâmetros `utm_*` da visita são repassados ao link.
- "Entrar" no header → `https://app.mecanify.com.br/`.

## 3. Home — seções em ordem

1. **Header fixo:** logo M, âncoras (Recursos, Telas, Planos, Dúvidas), "Entrar", botão âmbar "Testar 30 dias grátis". Mobile: menu compacto, CTA visível.
2. **Hero:** título, subtítulo, CTA primário, selo "30 dias grátis · sem cartão · sem fidelidade". Lado direito: notebook + celular 3D (seção 4).
3. **Faixa de dores:** OS no papel, cliente ligando perguntando do carro, peça usada e não cobrada.
4. **Recursos** (card por recurso, com print):
   - Pátio / Radar: o que está parado, em execução, pronto.
   - Ordens de serviço com etapas (Orçamento → Aguardando peça → Execução → Finalizado → Pago).
   - Orçamento enviado pelo WhatsApp do cliente; PIX na OS; avaliação pública da OS.
   - Clientes e veículos (placa como identidade).
   - Estoque de peças com baixa na OS.
   - Caixa, contas a pagar/receber, DRE.
   - Equipe e RH: ponto, holerite.
   - Perfis por cargo (Dono, Atendente, Mecânico, Financeiro): mecânico não vê o financeiro.
   - Auditoria: quem mexeu em qual OS ou peça.
5. **Tour de telas:** abas clicáveis (Radar, OS, Estoque, Financeiro, Equipe), alternando desktop e celular.
6. **Planos** (seção 7).
7. **Como funciona o teste:** 30 dias com tudo do Pátio Pro liberado, sem cartão, sem fidelidade, sem pegadinha. Dados nunca são apagados.
8. **FAQ** (com JSON-LD `FAQPage`). Inclui: preciso de cartão? posso cancelar? meus dados? funciona no celular? como migro do papel/planilha? quantos usuários?
9. **CTA final** + **rodapé:** contato (WhatsApp, e-mail), CNPJ e razão social, links legais, "Preferências de cookies".

### Contato

- Botão flutuante de WhatsApp (`https://wa.me/<numero>?text=<mensagem padrão>`), todas as páginas.
- E-mail via `mailto:` com assunto pré-preenchido, no rodapé e no FAQ.

## 4. Hero 3D

- Three.js carregado só quando o hero está visível, depois do conteúdo principal.
- Modelos GLB próprios (notebook + celular), low-poly, compressão Draco. **Meta: ≤ 600 KB** (modelos + texturas).
- Telas dos aparelhos = prints do Radar como textura (desktop no notebook, mobile no celular).
- Interação: leve inclinação seguindo o mouse; rotação suave ligada ao scroll. Sem arrastar.
- **Fallback:** imagem WebP/AVIF pré-renderizada da mesma cena. Usada:
  - como LCP, antes do 3D carregar;
  - quando não há WebGL;
  - com `prefers-reduced-motion: reduce`;
  - em aparelhos fracos (`navigator.hardwareConcurrency <= 4` ou `deviceMemory <= 4`).
- Sem 3D renderizado fora da tela (pausa o loop quando o hero sai da viewport).

## 5. Prints do sistema

- Gerados neste repo com `npm run prints` (mocks do Playwright, dados simulados).
- Tema escuro, desktop 1440 px e mobile 390 px, `deviceScaleFactor: 2`.
- Convertidos para WebP/AVIF no repo da landing com `<img srcset>` e `width/height` explícitos.
- `scripts/README` do repo da landing documenta como regerar.

## 6. Planos

Toggle **Mensal / Anual**. Anual = 2 meses grátis (paga 10, usa 12), mostrado como valor mensal equivalente.

| | Bancada | Pátio Pro (destaque) | Oficina Full |
|---|---|---|---|
| Para quem | Mecânico solo | Oficina com 2 a 5 mecânicos | Centros automotivos maiores |
| Mensal | R$ 97 | R$ 197 | R$ 347 |
| Anual (equiv./mês) | R$ 80 | R$ 164 | R$ 289 |
| Usuários | 1 (dono) | Até 5 | Ilimitados |
| Módulos | Clientes, veículos, OS, pátio | Tudo do Bancada + estoque e caixa | Tudo do Pátio Pro |
| Equipe | — | Perfis por cargo + RH | Completo + auditoria/logs |
| Orçamento WhatsApp + PIX | Sim | Sim | Sim |
| Suporte | Padrão | Padrão | Prioritário |

- Todos os botões levam ao cadastro (teste começa no Pátio Pro).
- Valores anuais arredondados para baixo a partir de `mensal × 10 / 12`; calculados em `site.config.ts`, não digitados.
- JSON-LD `SoftwareApplication` com `offers` por plano.

## 7. SEO

- `<title>` e `meta description` por página; canonical; `lang="pt-BR"`.
- Open Graph + Twitter card, imagem 1200×630.
- JSON-LD: `Organization`, `SoftwareApplication`, `FAQPage`.
- `sitemap.xml` (integração Astro) e `robots.txt`.
- Palavras-alvo da home: "sistema para oficina mecânica", "ordem de serviço oficina", "controle de estoque oficina", "software oficina mecânica".
- Um `h1` por página; textos dos recursos como HTML real (não dentro de imagem).
- **Meta Lighthouse mobile:** Performance, SEO, Acessibilidade e Boas práticas ≥ 95.

## 8. Cookies e rastreio (LGPD)

- Banner próprio, sem biblioteca de terceiros: **Aceitar**, **Recusar**, **Personalizar** (Analytics / Marketing).
- Google Consent Mode v2: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` = `denied` por padrão.
- Carregamento:
  - GA4 → só após aceite de Analytics.
  - Meta Pixel e Google Ads → só após aceite de Marketing.
  - Vercel Analytics → sempre (não usa cookie).
- Escolha salva em `localStorage` por 12 meses, com versão da política (nova versão = pergunta de novo).
- Link "Preferências de cookies" no rodapé reabre o painel.
- **Eventos:** `cta_cadastro` (com seção de origem), `cta_entrar`, `whatsapp_click`, `email_click`, `plano_toggle_anual`.

## 9. Páginas legais

- Rascunhos escritos com base no que o site coleta (GA4, Pixel, Ads, Vercel Analytics, cliques de contato).
- **Texto em Markdown**, um arquivo por página: `src/content/legal/privacidade.md`, `termos.md`, `cookies.md`. Editar o texto = editar o `.md`, sem tocar em código.
- Frontmatter: `titulo`, `atualizadoEm`, `revisado` (`false` por padrão).
- Com `revisado: false`, a página mostra o aviso "Rascunho — revisão jurídica pendente". Após a revisão, trocar para `true` remove o aviso.
- Dados da empresa (razão social, CNPJ, e-mail) entram nos textos via `site.config.ts`, não digitados no `.md`.

## 10. Acessibilidade

- WCAG 2.2 AA (mesmo padrão do sistema): texto ≥ 4.5:1, alvos ≥ 44 px, foco visível âmbar.
- Canvas 3D com `aria-hidden`; o fallback/legenda descreve a cena.
- Toggle de planos e abas do tour acessíveis por teclado (`role="tablist"`/`radiogroup`).

## 11. Testes

- **Playwright:**
  - navegação por âncoras e páginas legais;
  - CTA leva ao cadastro com `utm_*` repassados;
  - nenhum script de GA4/Pixel/Ads antes do aceite; carregam após aceite da categoria certa;
  - fallback do 3D com WebGL desligado e com `reduced-motion`;
  - toggle anual muda os valores.
- **Lighthouse CI** no PR com as metas da seção 7.
- **Contraste:** teste de tokens portado de `tests/unit/contraste.test.ts`.

## 12. Fora de escopo

- Blog e páginas por recurso.
- Bot automático de status e multi-unidades na comunicação.
- Formulário de contato com backend.
- Tema claro.
- Cobrança/assinatura dentro da landing (fica no sistema).

## 13. Pendências antes de publicar

Todas ficam para depois, sem bloquear o desenvolvimento:

- Contato e empresa → `src/site.config.ts`.
- IDs de rastreio → variáveis de ambiente na Vercel.
- Revisão jurídica → `.md` em `src/content/legal/` + `revisado: true`.
- DNS: apex e `www` na Vercel da landing; `app.` apontando para o projeto do sistema.
- Repo `mecanify-site`: criado pelo usuário no GitHub (vazio).
