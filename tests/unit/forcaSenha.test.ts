import { describe, expect, it } from 'vitest';
import { avaliarSenha, temData, temSequencia } from '../../src/lib/forcaSenha';

const ctx = { oficina: 'Auto Centro Irmãos Silva', nome: 'Carlos Mecânico', email: 'carlos.silva@oficina.com.br' };

describe('forcaSenha', () => {
  it('vazia', () => expect(avaliarSenha('').nivel).toBe('vazia'));
  it('curta é fraca', () => expect(avaliarSenha('Ab1!').nivel).toBe('fraca'));
  it('sequências são fracas', () => {
    expect(avaliarSenha('abcd', ctx).avisos.join()).toMatch(/sequências/);
    expect(avaliarSenha('Xk9!1234Zq', ctx).nivel).toBe('fraca');
    expect(temSequencia('4321')).toBe(true);
    expect(temSequencia('qwerty')).toBe(true);
    expect(temSequencia('a1c3e5g7')).toBe(false);
  });
  it('repetição é fraca', () => expect(avaliarSenha('Zzzzz!Mu7x', ctx).nivel).toBe('fraca'));
  it('datas de aniversário e nascimento são fracas', () => {
    for (const s of ['Pedro25031990', 'Pedro250390x', 'p@ss1990Forte', '25/03/1990Aa!']) {
      expect(avaliarSenha(s, ctx).avisos.join(), s).toMatch(/datas/);
      expect(avaliarSenha(s, ctx).nivel, s).toBe('fraca');
    }
    expect(temData('Tr0ca!Pneu#Azul')).toBe(false);
  });
  it('nome da oficina, do mecânico e e-mail são fracos (sem acento e sem caixa)', () => {
    expect(avaliarSenha('Irmaos#Forte77x', ctx).nivel).toBe('fraca');
    expect(avaliarSenha('MECANICO-carlos-9!', ctx).nivel).toBe('fraca');
    expect(avaliarSenha('autocentroirmaos!Z9', ctx).nivel).toBe('fraca');
    expect(avaliarSenha('carlos.silva#Zx8', ctx).nivel).toBe('fraca');
  });
  it('palavras genéricas do nome da oficina não pesam sozinhas', () => {
    expect(avaliarSenha('Auto#Bomba-Vento-82', { oficina: 'Auto Centro X' }).avisos).toEqual([]);
  });
  it('níveis sem previsibilidade', () => {
    expect(avaliarSenha('Tuboazul', ctx).nivel).toBe('fraca'); // 8 letras, 2 classes
    expect(avaliarSenha('Tuboazul8', ctx).nivel).toBe('razoavel');
    expect(avaliarSenha('Tuboazul8Mel', ctx).nivel).toBe('boa');
    expect(avaliarSenha('Tuboazul8!Mel#Cafe', ctx).nivel).toBe('forte');
  });
  it('nunca remove a senha: só avisa (sem bloqueio)', () => {
    const r = avaliarSenha('12345678', ctx);
    expect(r.nivel).toBe('fraca');
    expect(r.segmentos).toBe(1);
  });
  it('critérios', () => {
    expect(avaliarSenha('Abcdefg1!', {}).criterios).toEqual({ tamanho: true, maiuscula: true, numero: true, simbolo: true });
  });
});
