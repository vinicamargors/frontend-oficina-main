import { useMemo } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { avaliarSenha, type ContextoSenha, type NivelSenha } from '../../lib/forcaSenha';

const ROTULO: Record<NivelSenha, string> = { vazia: '', fraca: 'Senha fraca', razoavel: 'Senha razoável', boa: 'Senha boa', forte: 'Senha forte' };
const COR_BARRA: Record<NivelSenha, string> = { vazia: 'bg-line', fraca: 'bg-danger', razoavel: 'bg-warning', boa: 'bg-brand', forte: 'bg-success' };
const COR_TEXTO: Record<NivelSenha, string> = { vazia: 'text-ink-subtle', fraca: 'text-danger', razoavel: 'text-warning', boa: 'text-brand-ink', forte: 'text-success' };

/** Medidor de força: só orienta, nunca bloqueia. Senha previsível (sequência, data, nome) fica "fraca" com o motivo. */
export function MedidorSenha({ id, senha, contexto }: { id: string; senha: string; contexto?: ContextoSenha }) {
  const r = useMemo(() => avaliarSenha(senha, contexto), [senha, contexto?.oficina, contexto?.nome, contexto?.email]); // eslint-disable-line react-hooks/exhaustive-deps
  const itens: { ok: boolean; rotulo: string }[] = [
    { ok: r.criterios.tamanho, rotulo: '8 caracteres' },
    { ok: r.criterios.maiuscula, rotulo: 'Letra maiúscula' },
    { ok: r.criterios.numero, rotulo: 'Número' },
    { ok: r.criterios.simbolo, rotulo: 'Símbolo' },
  ];
  return (
    <div id={id} className="space-y-2.5 rounded-xl bg-muted p-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className={`block h-full origin-left rounded-full transition-[transform,background-color] duration-300 ease-out motion-reduce:transition-none ${COR_BARRA[r.nivel]} ${
                  n <= r.segmentos ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </span>
          ))}
        </div>
        <span className={`min-w-28 text-right text-[0.8125rem] font-medium transition-colors ${COR_TEXTO[r.nivel]}`} role="status" aria-live="polite">
          {ROTULO[r.nivel] || 'Crie uma senha'}
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Dicas de senha">
        {itens.map((i) => (
          <li
            key={i.rotulo}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors duration-200 ${
              i.ok ? 'bg-success/15 text-success' : 'bg-surface text-ink-muted'
            }`}
          >
            <Check size={12} strokeWidth={2.5} aria-hidden="true" className={`transition-opacity ${i.ok ? 'opacity-100' : 'opacity-30'}`} />
            {i.rotulo}
            <span className="sr-only">{i.ok ? ' (ok)' : ' (falta)'}</span>
          </li>
        ))}
      </ul>

      {r.avisos.length > 0 ? (
        <ul className="space-y-1">
          {r.avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-xs text-warning">
              <CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">
          {r.nivel === 'vazia' ? 'Uma frase longa e fácil de lembrar funciona bem. Você pode usar a senha que quiser.' : r.nivel === 'forte' ? 'Ótima escolha.' : 'Quanto mais longa e variada, mais forte.'}
        </p>
      )}
    </div>
  );
}
