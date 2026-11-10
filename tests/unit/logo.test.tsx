import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandMark, Logo } from '../../src/components/ui';

afterEach(cleanup);

function coresDoDesenho(svg: Element): string[] {
  return [svg, ...Array.from(svg.querySelectorAll('*'))].flatMap((el) =>
    ['fill', 'stroke'].map((a) => el.getAttribute(a)).filter((v): v is string => v !== null),
  );
}

describe('BrandMark', () => {
  it('é um <svg> acessível chamado "Mecanify", vetorial e em currentColor', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Mecanify');
    expect(svg.getAttribute('viewBox')).toMatch(/^[\d.\s-]+$/);
    expect(svg.querySelector('image')).toBeNull();
    expect(svg.querySelector('text')).toBeNull();
    const cores = coresDoDesenho(svg);
    expect(cores).toContain('currentColor');
    expect(cores.every((c) => c === 'currentColor' || c === 'none')).toBe(true);
  });

  it('respeita tamanho (altura) e titulo', () => {
    render(<BrandMark tamanho={40} titulo="Marca" />);
    const svg = screen.getByRole('img', { name: 'Marca' });
    expect(svg.getAttribute('height')).toBe('40');
  });
});

describe('Logo', () => {
  it('monograma + palavra "mecanify" com "ify" em âmbar, um único nome acessível', () => {
    const { container } = render(<Logo />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Mecanify' })).toBeTruthy();
    expect(container.textContent).toContain('mecanify');
    expect(container.textContent).not.toContain('GESTÃO DE OS');
    expect(container.querySelector('.text-brand-ink')?.textContent).toBe('ify');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('com legenda mostra "GESTÃO DE OS"', () => {
    const { container } = render(<Logo legenda />);
    expect(container.textContent).toContain('GESTÃO DE OS');
  });

  it('monocromático não usa classes de marca', () => {
    const { container } = render(<Logo legenda monocromatico />);
    const classes = Array.from(container.querySelectorAll('[class]')).map((el) => el.getAttribute('class') ?? '');
    expect(classes.some((c) => /\btext-brand(-ink)?\b/.test(c))).toBe(false);
  });
});

describe('arquivos públicos do logo', () => {
  for (const nome of ['logo.svg', 'favicon.svg']) {
    it(`public/${nome} existe e é SVG válido com viewBox`, () => {
      const caminho = resolve(process.cwd(), 'public', nome);
      expect(existsSync(caminho)).toBe(true);
      const doc = new DOMParser().parseFromString(readFileSync(caminho, 'utf8'), 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      expect(doc.documentElement.nodeName).toBe('svg');
      expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy();
      expect(doc.querySelector('image')).toBeNull();
    });
  }
});
