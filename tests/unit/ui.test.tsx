import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Field, PageHeader, PlateChip, StatusBadge, Tabs, STATUS_OS } from '../../src/components/ui';
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
  it('define document.title', () => {
    render(<PageHeader titulo="Estoque" />);
    expect(document.title).toBe('Estoque · Mecanify');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Estoque');
  });
});
