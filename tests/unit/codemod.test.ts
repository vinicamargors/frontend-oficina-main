import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs sem tipos
import { transformar } from '../../scripts/codemod-tokens.mjs';

const t = (s: string): string => transformar(s);

const pares: Array<[string, string]> = [
  ['bg-[#071226]', 'bg-sunken'],
  ['bg-[#0B1B36]', 'bg-surface'],
  ['bg-[#12274D]', 'bg-surface'],
  ['hover:bg-[#12274D]', 'hover:bg-muted'],
  ['border-[#264577]', 'border-line'],
  ['border-[#3A5C90]', 'border-line-strong'],
  ['text-[#3A5C90]', 'text-ink-subtle'],
  ['bg-[#38BDF8] text-[#071226]', 'bg-brand text-on-brand'],
  ['hover:bg-[#0EA5E9]', 'hover:bg-brand-hover'],
  ['text-[#38BDF8]', 'text-brand-ink'],
  ['border-[#38BDF8]', 'border-brand'],
  ['ring-[#38BDF8]', 'ring-brand'],
  ['bg-[#2563EB]', 'bg-muted'],
  ['bg-[#1D4ED8]', 'bg-muted'],
  ['bg-[#1E3A8A]', 'bg-muted'],
  ['bg-[#172554]', 'bg-muted'],
  ['bg-[#1E3A8A] text-white', 'bg-muted text-ink'],
  ['text-white', 'text-ink'],
  ['bg-red-600 text-white', 'bg-danger-solid text-white'],
  ['bg-emerald-600 text-white', 'bg-success-solid text-white'],
  ['bg-[#38BDF8] text-white', 'bg-brand text-on-brand'],
  ['text-slate-200', 'text-ink'],
  ['text-slate-300', 'text-ink-muted'],
  ['text-slate-400', 'text-ink-subtle'],
  ['text-slate-500', 'text-ink-subtle'],
  ['text-slate-600', 'text-ink-subtle'],
  ['text-red-400', 'text-danger'],
  ['border-rose-500/40', 'border-danger/40'],
  ['bg-red-950/30', 'bg-danger/30'],
  ['text-emerald-300', 'text-success'],
  ['border-green-500', 'border-success'],
  ['text-amber-400', 'text-warning'],
  ['bg-yellow-500/10', 'bg-warning/10'],
  ['text-orange-300', 'text-warning'],
  ['text-blue-300', 'text-info'],
  ['border-sky-500', 'border-info'],
  ['text-indigo-300', 'text-info'],
  ['text-teal-300', 'text-done'],
  ['bg-green-600', 'bg-success-solid'],
  ['font-extrabold', 'font-semibold'],
  ['font-black', 'font-semibold'],
  ['font-bold', 'font-semibold'],
  ['text-[9px]', 'text-xs'],
  ['text-[10px]', 'text-xs'],
  ['text-[11px]', 'text-xs'],
  ['rounded-2xl', 'rounded-lg'],
  ['rounded-3xl', 'rounded-lg'],
  ['<input className="bg-[#071226] border-[#264577]" />', '<input className="bg-sunken border-line" />'],
  ['<div className="min-h-dvh bg-[#071226]">', '<div className="min-h-dvh bg-canvas">'],
];

describe('codemod de tokens', () => {
  it.each(pares)('%s -> %s', (entrada, saida) => {
    expect(t(entrada)).toBe(saida);
  });

  it('preserva variantes e opacidade', () => {
    expect(t('hover:bg-[#0B1B36]/70')).toBe('hover:bg-surface/70');
    expect(t('focus:border-[#38BDF8]')).toBe('focus:border-brand');
  });

  it('não altera classes print:', () => {
    const s = 'print:bg-white print:text-black print:text-[11px] print:font-bold';
    expect(t(s)).toBe(s);
  });

  it('não altera região marcada como ignorada', () => {
    const s = '{/* codemod:ignore-start */}\n<div className="text-[11px] bg-gray-100 font-bold">\n{/* codemod:ignore-end */}';
    expect(t(s)).toBe(s);
  });

  it('é idempotente', () => {
    const s = '<button className="bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#071226] font-black text-[10px] rounded-2xl">\n<p className="text-slate-300 bg-red-600 text-white border-emerald-500/30">';
    const uma = t(s);
    expect(t(uma)).toBe(uma);
  });

  it('purple falha com a linha para decisão manual', () => {
    expect(() => t('<span className="bg-purple-950 text-purple-300">')).toThrow(/purple/);
  });
});
