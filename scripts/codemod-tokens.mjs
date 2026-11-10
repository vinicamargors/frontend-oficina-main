#!/usr/bin/env node
// Codemod: hex arbitrários e cores Tailwind da paleta antiga viram tokens semânticos.
// Uso: node scripts/codemod-tokens.mjs src
// Regiões entre `codemod:ignore-start` e `codemod:ignore-end` (folha de impressão) não mudam,
// nem classes com variante `print:`.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join as joinPath } from 'node:path';

const PROP = '(?:bg|text|border|ring|divide|from|to|via|shadow|placeholder|outline|fill|stroke|decoration|accent|caret)';

// hex (maiúsculo) -> papel, por propriedade
function mapearHex(prop, hex, linha) {
  const H = hex.toUpperCase();
  const isBg = prop === 'bg' || prop === 'from' || prop === 'to' || prop === 'via';
  switch (H) {
    case '071226':
      if (prop === 'text') return 'on-brand';
      if (isBg) {
        if (/<(input|select|textarea)\b/.test(linha) || /focus:border/.test(linha)) return 'sunken';
        if (/min-h-(dvh|screen)|<aside\b|<body\b|<main\b/.test(linha)) return 'canvas';
        return 'sunken';
      }
      return 'line';
    case '0B1B36':
      return isBg ? 'surface' : 'line';
    case '12274D':
      return isBg ? 'surface' : 'line';
    case '264577':
      return isBg ? 'muted' : 'line';
    case '3A5C90':
      return prop === 'text' ? 'ink-subtle' : isBg ? 'muted' : 'line-strong';
    case '38BDF8':
      if (prop === 'text') return 'brand-ink';
      return 'brand';
    case '0EA5E9':
      return prop === 'text' ? 'brand-ink' : 'brand-hover';
    case '2563EB':
    case '1D4ED8':
    case '172554':
      if (isBg) return 'muted';
      if (prop === 'text') return 'info';
      return 'brand';
    case '1E3A8A':
      if (isBg) return 'muted';
      if (prop === 'text') return 'info';
      return 'line';
    case 'F8FAFC':
      return prop === 'text' ? 'ink' : 'surface';
    default:
      return null;
  }
}

function mapearPaleta(prop, cor, tom, alpha) {
  const n = Number(tom);
  const semAlpha = !alpha;
  const isBg = prop === 'bg';
  const tinta = (nome) => {
    // fundo claro/escuro demais sem opacidade explícita vira tinta suave, não cor cheia
    if (isBg && semAlpha && (n <= 300 || n >= 800)) return `${nome}/15`;
    return nome;
  };
  const solido = (nome) => (isBg && semAlpha && n >= 500 && n <= 700 ? `${nome}-solid` : nome);
  switch (cor) {
    case 'red':
    case 'rose':
      return tinta(solido('danger')) + (alpha || '');
    case 'emerald':
    case 'green':
      return tinta(solido('success')) + (alpha || '');
    case 'amber':
    case 'yellow':
    case 'orange':
      return tinta('warning') + (alpha || '');
    case 'blue':
    case 'sky':
    case 'indigo':
      return tinta('info') + (alpha || '');
    case 'teal':
      return tinta('done') + (alpha || '');
    case 'slate':
    case 'gray':
    case 'zinc':
    case 'neutral':
    case 'stone': {
      if (prop === 'text' || prop === 'placeholder' || prop === 'fill' || prop === 'stroke' || prop === 'decoration') {
        const nome = n <= 200 ? 'ink' : n <= 300 ? 'ink-muted' : n <= 600 ? 'ink-subtle' : 'ink-muted';
        return nome + (alpha || '');
      }
      if (prop === 'bg' || prop === 'from' || prop === 'to' || prop === 'via') {
        return (n <= 200 ? 'muted' : n >= 800 ? 'surface' : 'muted') + (alpha || '');
      }
      return (n <= 300 ? 'line' : 'line-strong') + (alpha || '');
    }
    case 'purple':
    case 'violet':
    case 'fuchsia':
    case 'pink':
    case 'cyan':
    case 'lime':
      throw new Error(`cor sem mapeamento automático (${cor}): decidir à mão (info ou muted)`);
    default:
      return null;
  }
}

const RE_TOKEN = new RegExp(
  String.raw`(?<![\w\-\[\]#.:/])((?:[a-z0-9-]+:)*)(!?)(${PROP})-(\[#([0-9a-fA-F]{3,8})\]|(red|rose|emerald|green|amber|yellow|orange|blue|sky|indigo|teal|slate|gray|zinc|neutral|stone|purple|violet|fuchsia|pink|cyan|lime)-(\d{2,3}))((?:/\d+)?)(?![\w\-\[])`,
  'g',
);

const RE_MISC = /(?<![\w\-\[\]#.:/])((?:[a-z0-9-]+:)*)(font-extrabold|font-black|font-bold|text-\[(?:9|10|11)px\]|rounded-2xl|rounded-3xl|text-white)(?![\w\-\[\]/])/g;

function transformarLinha(linha, numero) {
  let out = linha.replace(RE_TOKEN, (m, variantes, bang, prop, _corpo, hex, cor, tom, alpha) => {
    if (/(^|:)print:/.test(variantes)) return m;
    let nome;
    if (hex) {
      // hover:bg-[#12274D] vira muted (linha/item interativo)
      if (/(^|:)hover:/.test(variantes) && prop === 'bg' && hex.toUpperCase() === '12274D') {
        return `${variantes}${bang}bg-muted${alpha}`;
      }
      nome = mapearHex(prop, hex, linha);
      if (nome == null) return m;
      return `${variantes}${bang}${prop}-${nome}${alpha}`;
    }
    try {
      nome = mapearPaleta(prop, cor, tom, alpha);
    } catch (e) {
      throw new Error(`${e.message} — linha ${numero}: ${linha.trim()}`);
    }
    if (nome == null) return m;
    // alpha já embutido em `nome` pela paleta; evita duplicar
    return `${variantes}${bang}${prop}-${nome}`;
  });

  const temSolido = /(^|[\s"'`:])bg-(danger-solid|success-solid)(?![\w-])/.test(out);
  const temBrand = /(^|[\s"'`:])bg-brand(?![\w-])/.test(out);
  out = out.replace(RE_MISC, (m, variantes, base) => {
    if (/(^|:)print:/.test(variantes)) return m;
    switch (base) {
      case 'font-extrabold':
      case 'font-black':
      case 'font-bold':
        return `${variantes}font-semibold`;
      case 'rounded-2xl':
      case 'rounded-3xl':
        return `${variantes}rounded-lg`;
      case 'text-white':
        if (temBrand) return `${variantes}text-on-brand`;
        if (temSolido) return m;
        return `${variantes}text-ink`;
      default:
        return `${variantes}text-xs`; // text-[9px|10px|11px]
    }
  });
  return out;
}

// Em linhas com `bg-brand`, o texto escuro antigo (text-[#071226]) já virou text-on-brand pelo mapa de hex.
export function transformar(fonte) {
  const linhas = fonte.split('\n');
  let ignorando = false;
  return linhas
    .map((linha, i) => {
      if (linha.includes('codemod:ignore-start')) {
        ignorando = true;
        return linha;
      }
      if (linha.includes('codemod:ignore-end')) {
        ignorando = false;
        return linha;
      }
      if (ignorando) return linha;
      return transformarLinha(linha, i + 1);
    })
    .join('\n');
}

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = joinPath(dir, nome);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx|css)$/.test(p) ? [p] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const alvo = process.argv[2] || 'src';
  let mudados = 0;
  let falhas = 0;
  for (const arq of arquivos(alvo)) {
    const antes = readFileSync(arq, 'utf8');
    let depois;
    try {
      depois = transformar(antes);
    } catch (e) {
      falhas++;
      console.error(`${arq}: ${e.message}`);
      continue;
    }
    if (depois !== antes) {
      writeFileSync(arq, depois);
      mudados++;
    }
  }
  console.log(`${mudados} arquivo(s) alterado(s)${falhas ? `, ${falhas} falha(s) a resolver à mão` : ''}`);
  if (falhas) process.exitCode = 1;
}
