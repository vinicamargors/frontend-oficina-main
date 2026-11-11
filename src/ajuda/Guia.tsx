import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { ImagemAnotada } from './ImagemAnotada';
import type { GuiaDef } from './tipos';

export function Guia({ guia, aoVoltar }: { guia: GuiaDef; aoVoltar: () => void }) {
  return (
    <div>
      <PageHeader
        titulo={guia.titulo}
        acoes={
          <Button variante="fantasma" icone={ArrowLeft} onClick={aoVoltar}>
            Todos os guias
          </Button>
        }
        abaixo={guia.resumo}
      />
      <ol className="max-w-2xl space-y-6">
        {guia.passos.map((p, i) => (
          <li key={i} className="flex gap-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums text-ink"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink text-pretty">
                <span className="sr-only">Passo {i + 1}: </span>
                {p.texto}
              </p>
              {p.imagem && <ImagemAnotada guiaId={guia.id} indice={i} imagem={p.imagem} />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
