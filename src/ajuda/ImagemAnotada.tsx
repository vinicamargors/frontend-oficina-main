import { useState } from 'react';
import anotacoes from './anotacoes.json';
import type { PassoGuia } from './tipos';

type Caixa = { x: number; y: number; w: number; h: number };
const NOTAS = anotacoes as Record<string, Record<string, Caixa>>;

/** Print limpo com marcadores numerados e destaque desenhados por cima (texto real, não pixels). Sem imagem ou sem caixas: nada. */
export function ImagemAnotada({ guiaId, indice, imagem }: { guiaId: string; indice: number; imagem: NonNullable<PassoGuia['imagem']> }) {
  const [falhou, setFalhou] = useState(false);
  const caixas = NOTAS[`${guiaId}/${indice + 1}`];
  if (falhou) return null;
  const base = `/ajuda/${guiaId}/${imagem.arquivo}`;
  return (
    <figure className="mt-3 overflow-hidden rounded-xl bg-muted">
      <div className="relative">
        <img
          src={base}
          alt={imagem.alt}
          loading="lazy"
          decoding="async"
          onError={() => setFalhou(true)}
          className="block h-auto w-full"
        />
        {imagem.alvos.map((alvo, k) => {
          const c = caixas?.[alvo];
          if (!c) return null;
          return (
            <span key={alvo} aria-hidden="true">
              <span
                className="absolute rounded-md ring-2 ring-brand"
                style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
              />
              <span
                className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand"
                style={{ left: `calc(${c.x}% - 6px)`, top: `calc(${c.y}% - 10px)` }}
              >
                {k + 1}
              </span>
            </span>
          );
        })}
      </div>
    </figure>
  );
}
