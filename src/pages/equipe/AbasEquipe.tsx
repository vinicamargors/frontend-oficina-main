import { useEffect, useRef, useState } from 'react';
import { Tabs, type TabItem } from '../../components/ui';

/**
 * Faixa de abas numa linha só. No celular, quando não cabe, rola dentro da própria faixa (nunca a página),
 * com um esmaecido na borda que ainda tem abas escondidas; a aba escolhida é trazida para a vista.
 */
export function AbasEquipe({
  itens,
  ativo,
  aoMudar,
  idPainel,
}: {
  itens: TabItem[];
  ativo: string;
  aoMudar: (id: string) => void;
  idPainel: string;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [bordas, setBordas] = useState({ inicio: false, fim: false });

  useEffect(() => {
    const trilho = raiz.current?.querySelector<HTMLElement>('[role="tablist"]');
    if (!trilho) return;
    const medir = () =>
      setBordas({
        inicio: trilho.scrollLeft > 2,
        fim: trilho.scrollLeft + trilho.clientWidth < trilho.scrollWidth - 2,
      });
    medir();
    trilho.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      trilho.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, []);

  useEffect(() => {
    const trilho = raiz.current?.querySelector<HTMLElement>('[role="tablist"]');
    const aba = raiz.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!trilho || !aba) return;
    const fora = aba.offsetLeft < trilho.scrollLeft || aba.offsetLeft + aba.offsetWidth > trilho.scrollLeft + trilho.clientWidth;
    if (fora) trilho.scrollTo({ left: aba.offsetLeft - 24, behavior: 'smooth' });
  }, [ativo]);

  return (
    <div ref={raiz} className="relative mb-4 max-w-full">
      <Tabs itens={itens} ativo={ativo} aoMudar={aoMudar} rotuloGrupo="Seções da equipe" idPainel={idPainel} />
      {bordas.inicio && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-full bg-gradient-to-r from-canvas" />
      )}
      {bordas.fim && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-full bg-gradient-to-l from-canvas" />
      )}
    </div>
  );
}
