import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Badge, Button, Field, PageHeader, Panel, PlateChip, Skeleton, StatusBadge, Tabs, STATUS_OS } from '../../src/components/ui';
import type { StatusOS } from '../../src/types';

afterEach(cleanup);

describe('StatusBadge', () => {
  const esperado: Record<StatusOS, string> = {
    ORCAMENTO: 'Orçamento',
    AGUARDANDO_PECA: 'Aguardando peça',
    EXECUCAO: 'Em execução',
    FINALIZADO: 'Finalizado',
    PAGO: 'Pago / entregue',
  };
  for (const [status, rotulo] of Object.entries(esperado)) {
    it(`${status} mostra "${rotulo}" sem texto de enum`, () => {
      const { container } = render(<StatusBadge status={status as StatusOS} />);
      expect(screen.getByText(rotulo)).toBeTruthy();
      expect(container.textContent).not.toMatch(/[A-Z]{3,}_?[A-Z]*/);
      expect(STATUS_OS[status as StatusOS].rotulo).toBe(rotulo);
    });
  }
});

describe('Tabs', () => {
  const itens = [
    { id: 'a', rotulo: 'Primeira' },
    { id: 'b', rotulo: 'Segunda' },
  ];
  it('aria-selected, seta move foco, Enter chama aoMudar', async () => {
    const aoMudar = vi.fn();
    const user = userEvent.setup();
    render(<Tabs itens={itens} ativo="a" aoMudar={aoMudar} rotuloGrupo="Seções" />);
    const abas = screen.getAllByRole('tab');
    expect(abas[0].getAttribute('aria-selected')).toBe('true');
    expect(abas[1].getAttribute('aria-selected')).toBe('false');
    abas[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(abas[1]);
    await user.keyboard('{Enter}');
    expect(aoMudar).toHaveBeenCalledWith('b');
  });
});

describe('Field', () => {
  it('liga erro ao input', () => {
    render(
      <Field rotulo="Placa" erro="Placa inválida">
        <input />
      </Field>,
    );
    const input = screen.getByLabelText('Placa');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const id = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)?.textContent).toBe('Placa inválida');
  });
  it('anunciar: erro vira role=alert; sem a opção, não', () => {
    const { rerender } = render(
      <Field rotulo="Placa" erro="Placa inválida">
        <input />
      </Field>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <Field rotulo="Placa" erro="Placa inválida" anunciar>
        <input />
      </Field>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Placa inválida');
  });
});

describe('PlateChip', () => {
  it('formato antigo com hífen', () => {
    render(<PlateChip placa="abc1234" />);
    expect(screen.getByText('ABC-1234')).toBeTruthy();
  });
  it('Mercosul sem hífen', () => {
    render(<PlateChip placa="TST1A01" />);
    expect(screen.getByText('TST1A01')).toBeTruthy();
  });
});

describe('Button', () => {
  it('carregando desabilita e marca aria-busy', () => {
    render(<Button carregando>Salvar</Button>);
    const b = screen.getByRole('button') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });
});

describe('PageHeader', () => {
  it('h1 usa text-balance para não deixar palavra sozinha na última linha', () => {
    render(<PageHeader titulo="Estoque" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-balance');
  });

  it('define document.title', () => {
    render(<PageHeader titulo="Estoque" />);
    expect(document.title).toBe('Estoque · Mecanify');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Estoque');
  });
});

describe('linguagem estilo Binance', () => {
  it('Panel: rounded-2xl, padding por espaco e nenhuma borda', () => {
    const { container, rerender } = render(<Panel>x</Panel>);
    const el = container.firstElementChild!;
    expect(el.className).toMatch(/\brounded-2xl\b/);
    expect(el.className).toMatch(/\bp-5\b/);
    expect(el.className).not.toMatch(/(^|\s)(dark:)?border(-|\s|$)/);
    rerender(<Panel espaco="lg">x</Panel>);
    expect(container.firstElementChild!.className).toMatch(/\bp-6\b/);
  });

  it('Tabs: pílulas rounded-full, trilho muted e aria-controls com idPainel', () => {
    render(<Tabs itens={[{ id: 'a', rotulo: 'A' }, { id: 'b', rotulo: 'B' }]} ativo="a" aoMudar={() => {}} rotuloGrupo="Seções" idPainel="painel-x" />);
    const lista = screen.getByRole('tablist');
    expect(lista.className).toMatch(/\brounded-full\b/);
    expect(lista.className).toMatch(/\bbg-muted\b/);
    const [a, b] = screen.getAllByRole('tab');
    expect(a.className).toMatch(/\brounded-full\b/);
    expect(a.className).toMatch(/\bbg-surface\b/);
    expect(b.className).toMatch(/\btext-ink-muted\b/);
    expect(a.getAttribute('aria-controls')).toBe('painel-x');
  });

  it('Tabs: sem idPainel não inventa aria-controls', () => {
    render(<Tabs itens={[{ id: 'a', rotulo: 'A' }]} ativo="a" aoMudar={() => {}} rotuloGrupo="Seções" />);
    expect(screen.getByRole('tab').hasAttribute('aria-controls')).toBe(false);
  });

  it('Field mescla aria-describedby do filho', () => {
    render(
      <>
        <p id="ajuda-externa">Ajuda</p>
        <Field rotulo="Placa" erro="Placa inválida">
          <input aria-describedby="ajuda-externa" />
        </Field>
      </>,
    );
    const ids = screen.getByLabelText('Placa').getAttribute('aria-describedby')!.split(' ');
    expect(ids).toContain('ajuda-externa');
    expect(ids.some((id) => document.getElementById(id)?.textContent === 'Placa inválida')).toBe(true);
  });

  it('Field mantém aria-invalid do filho quando não há erro', () => {
    render(
      <Field rotulo="Nome">
        <input aria-invalid />
      </Field>,
    );
    expect(screen.getByLabelText('Nome').getAttribute('aria-invalid')).toBe('true');
  });

  it('Skeleton anuncia carregamento', () => {
    render(<Skeleton linhas={2} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Carregando');
  });

  it('Button sm tem alvo de toque de 44px no mobile e rounded-lg', () => {
    render(<Button tamanho="sm">Ok</Button>);
    const b = screen.getByRole('button');
    expect(b.className).toMatch(/\bmin-h-11\b/);
    expect(b.className).toMatch(/\bmd:min-h-8\b/);
    expect(b.className).toMatch(/\brounded-lg\b/);
  });

  it('Button perigo não usa text-white solto', () => {
    render(<Button variante="perigo">Excluir</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/\btext-white\b/);
  });

  it('Badge é pílula', () => {
    render(<Badge>Novo</Badge>);
    expect(screen.getByText('Novo').className).toMatch(/\brounded-full\b/);
  });

  it('PlateChip tem role img com o nome da placa', () => {
    render(<PlateChip placa="abc1234" />);
    expect(screen.getByRole('img', { name: 'Placa ABC-1234' })).toBeTruthy();
  });
});
