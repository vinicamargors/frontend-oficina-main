export type NivelSenha = 'vazia' | 'fraca' | 'razoavel' | 'boa' | 'forte';

export type ContextoSenha = { oficina?: string; nome?: string; email?: string };

export type ResultadoSenha = {
  nivel: NivelSenha;
  /** Quantos dos 4 segmentos da barra acendem (0 a 4). */
  segmentos: 0 | 1 | 2 | 3 | 4;
  /** Avisos do que torna a senha previsível (a senha nunca é bloqueada). */
  avisos: string[];
  criterios: { tamanho: boolean; maiuscula: boolean; numero: boolean; simbolo: boolean };
};

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const TECLADO = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const COMUNS = ['senha', 'password', 'mecanico', 'oficina', 'admin', 'abc123', 'mudar123', 'carro', 'mecanify', 'brasil', 'qwerty', 'letmein'];
const PALAVRAS_SOLTAS = new Set(['auto', 'centro', 'mecanica', 'oficina', 'car', 'cars', 'moto', 'motos', 'automoveis', 'servicos', 'ltda', 'epp', 'eireli']);

/** Sequência crescente ou decrescente de 4+ caracteres consecutivos (1234, 4321, abcd, dcba) ou trecho de teclado (qwer, asdf). */
export function temSequencia(s: string): boolean {
  for (let i = 0; i + 3 < s.length; i++) {
    const c = [0, 1, 2, 3].map((k) => s.charCodeAt(i + k));
    const passos = [c[1] - c[0], c[2] - c[1], c[3] - c[2]];
    if (passos.every((p) => p === 1) || passos.every((p) => p === -1)) return true;
  }
  for (const linha of TECLADO) {
    const inversa = [...linha].reverse().join('');
    for (let i = 0; i + 4 <= linha.length; i++) {
      if (s.includes(linha.slice(i, i + 4)) || s.includes(inversa.slice(i, i + 4))) return true;
    }
  }
  return false;
}

export function temRepeticao(s: string): boolean {
  return /(.)\1{3,}/.test(s);
}

const diaMesValidos = (d: number, m: number) => d >= 1 && d <= 31 && m >= 1 && m <= 12;

/** Datas como aniversário e nascimento: ddmmaaaa, aaaammdd, ddmmaa, ou um ano de 1930 a 2030 solto. */
export function temData(bruta: string): boolean {
  const s = bruta.replace(/(?<=\d)[/.\-\s](?=\d)/g, '');
  for (const m of s.matchAll(/\d{4,8}/g)) {
    const t = m[0];
    for (let i = 0; i + 8 <= t.length; i++) {
      const x = t.slice(i, i + 8);
      const ano1 = Number(x.slice(4));
      if (diaMesValidos(Number(x.slice(0, 2)), Number(x.slice(2, 4))) && ano1 >= 1900 && ano1 <= 2099) return true;
      const ano2 = Number(x.slice(0, 4));
      if (diaMesValidos(Number(x.slice(6)), Number(x.slice(4, 6))) && ano2 >= 1900 && ano2 <= 2099) return true;
    }
    for (let i = 0; i + 6 <= t.length; i++) {
      const x = t.slice(i, i + 6);
      if (diaMesValidos(Number(x.slice(0, 2)), Number(x.slice(2, 4)))) return true;
    }
    for (let i = 0; i + 4 <= t.length; i++) {
      const ano = Number(t.slice(i, i + 4));
      if (ano >= 1930 && ano <= 2030) return true;
    }
  }
  return false;
}

function tokensDoContexto(c: ContextoSenha): string[] {
  const tokens: string[] = [];
  for (const texto of [c.oficina, c.nome]) {
    if (!texto) continue;
    const palavras = normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);
    for (const p of palavras) if (p.length >= 4 && !PALAVRAS_SOLTAS.has(p)) tokens.push(p);
    const junto = palavras.join('');
    if (junto.length >= 4) tokens.push(junto);
  }
  if (c.email) {
    const local = normalizar(c.email.split('@')[0] ?? '').replace(/[^a-z0-9]/g, '');
    if (local.length >= 4) tokens.push(local);
  }
  return tokens;
}

export function avaliarSenha(senha: string, contexto: ContextoSenha = {}): ResultadoSenha {
  const criterios = {
    tamanho: senha.length >= 8,
    maiuscula: /\p{Lu}/u.test(senha),
    numero: /\d/.test(senha),
    simbolo: /[^\p{L}\d\s]/u.test(senha),
  };
  if (!senha) return { nivel: 'vazia', segmentos: 0, avisos: [], criterios };

  const n = normalizar(senha);
  const avisos: string[] = [];
  if (temSequencia(n)) avisos.push('Evite sequências como 1234 ou abcd.');
  if (temRepeticao(n)) avisos.push('Evite repetir o mesmo caractere.');
  if (temData(senha)) avisos.push('Evite datas, como aniversário ou ano de nascimento.');
  if (tokensDoContexto(contexto).some((t) => n.includes(t))) avisos.push('Evite usar o nome da oficina, o seu nome ou o e-mail.');
  if (senha.length < 14 && COMUNS.some((p) => n.includes(p))) avisos.push('Essa senha é muito comum.');

  const classes = [/\p{Ll}/u.test(senha), criterios.maiuscula, criterios.numero, criterios.simbolo].filter(Boolean).length;
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (senha.length >= 16) pontos++;
  if (classes >= 3) pontos++;
  if (classes >= 4) pontos++;

  let nivel: NivelSenha = senha.length < 6 || pontos <= 1 ? 'fraca' : pontos === 2 ? 'razoavel' : pontos === 3 ? 'boa' : 'forte';
  // Previsível = fraca, mas nunca bloqueada
  if (avisos.length > 0) nivel = 'fraca';
  const segmentos = (nivel === 'fraca' ? 1 : nivel === 'razoavel' ? 2 : nivel === 'boa' ? 3 : 4) as 1 | 2 | 3 | 4;
  return { nivel, segmentos, avisos, criterios };
}
