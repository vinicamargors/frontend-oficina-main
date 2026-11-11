import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';

/**
 * Casca das folhas de confirmação: `<dialog>` nativo com `showModal()` (Esc, foco preso, fundo).
 * Esc e clique no fundo chamam `aoCancelar`. No celular vira folha inferior; ≥640px, cartão central.
 * O foco inicial vai para o título (nunca para uma opção, que pareceria pré-marcada); nos formulários,
 * `focoInicial="primeiro-campo"` leva direto ao primeiro campo (evita um Tab extra).
 */
export function Folha({
  aberto,
  titulo,
  aoCancelar,
  children,
  tamanho = 'sm',
  fecharNoFundo = true,
  focoInicial = 'titulo',
  bloquearFechar = false,
}: {
  aberto: boolean;
  titulo: string;
  aoCancelar: () => void;
  children: ReactNode;
  /** `lg`: formulários longos (rola dentro da folha; ≥640px, cartão de 40rem). */
  tamanho?: 'sm' | 'lg';
  /** false: o clique no fundo não fecha (formulários, para um toque errado não descartar o que foi digitado). */
  fecharNoFundo?: boolean;
  /** `titulo` (padrão): confirmações e pagamento. `primeiro-campo`: formulários. */
  focoInicial?: 'titulo' | 'primeiro-campo';
  /** true: Esc não fecha nem pede para fechar (ex.: gravação em andamento). Sem isso, um 2º Esc fecharia o `<dialog>` à força. */
  bloquearFechar?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();
  // Último valor de `aberto`, para o `close` nativo saber se o fechamento veio do estado ou do navegador
  const abertoRef = useRef(aberto);
  abertoRef.current = aberto;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) {
      d.showModal();
      const campo =
        focoInicial === 'primeiro-campo'
          ? d.querySelector<HTMLElement>('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
          : null;
      (campo ?? tituloRef.current)?.focus();
    } else if (!aberto && d.open) {
      d.close();
    }
  }, [aberto]);

  // Fechada à força durante a gravação (ex.: gesto "voltar" do Android, que não passa por tecla nenhuma): quando a
  // gravação termina e o dono ainda quer a folha aberta (ex.: falhou e mostra o erro), ela volta à tela.
  // Quando a gravação acabou de terminar: um `close` nativo que chegue atrasado (do fechamento à força feito
  // durante a gravação) só reabre a folha, sem cancelar o que o dono quer mostrar (ex.: o erro).
  const desbloqueadaEm = useRef(0);
  const estavaBloqueada = useRef(bloquearFechar);
  useEffect(() => {
    if (estavaBloqueada.current && !bloquearFechar) desbloqueadaEm.current = Date.now();
    estavaBloqueada.current = bloquearFechar;
  }, [bloquearFechar]);
  useEffect(() => {
    const d = ref.current;
    if (!d || !aberto || bloquearFechar || d.open) return;
    d.showModal();
    tituloRef.current?.focus();
  }, [aberto, bloquearFechar]);

  const cancelar = (e: SyntheticEvent) => {
    e.preventDefault();
    aoCancelar();
  };

  // Gravação em andamento: o Esc é barrado no documento inteiro (o botão clicado fica desabilitado e o foco pode
  // sair da folha; um ouvinte só no <dialog> não veria a tecla e o navegador fecharia a folha).
  useEffect(() => {
    if (!aberto || !bloquearFechar) return;
    const barrarEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', barrarEsc, true);
    return () => document.removeEventListener('keydown', barrarEsc, true);
  }, [aberto, bloquearFechar]);

  // O Chrome fecha o <dialog> à força num 2º Esc seguido (sem ativação do usuário, o `cancel` não pode ser
  // impedido). Se o estado ainda diz "aberto", reabre e segue o mesmo caminho do Esc (`aoCancelar`): o dono
  // decide (fechar ou pedir "Descartar alterações?") e a tela nunca fica com uma folha escondida e travada.
  const aoFecharNativo = () => {
    const d = ref.current;
    if (!d || !abertoRef.current || d.open) return;
    // Gravação em andamento: o Esc já é barrado no documento; um fechamento vindo de outro lugar é respeitado até a
    // gravação terminar: aí o dono fecha (`aberto` false) ou a folha volta com o erro (efeito acima).
    if (bloquearFechar) return;
    d.showModal();
    if (Date.now() - desbloqueadaEm.current > 1000) aoCancelar();
  };

  const cliqueNoFundo = (e: MouseEvent<HTMLDialogElement>) => {
    if (fecharNoFundo && !bloquearFechar && e.target === ref.current) aoCancelar();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onCancel={cancelar}
      onClose={aoFecharNativo}
      onClick={cliqueNoFundo}
      className={`m-0 mt-auto w-full max-w-full rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-ink/40 dark:backdrop:bg-black/60 sm:m-auto sm:rounded-2xl ${
        tamanho === 'lg' ? 'max-h-[92dvh] overflow-y-auto sm:w-[40rem]' : 'sm:w-[28rem]'
      }`}
    >
      {aberto && (
        <div className="space-y-5 p-5 sm:p-6" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <h2 id={idTitulo} ref={tituloRef} tabIndex={-1} className="text-lg font-semibold text-ink focus:outline-none text-balance">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
