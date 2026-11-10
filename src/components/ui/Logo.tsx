import { BrandMark } from './BrandMark';

// Logo completo: monograma + palavra "mecanify" ("ify" em âmbar) e, opcional, a legenda "GESTÃO DE OS".
// Um só nome acessível ("Mecanify"); as partes internas são apresentação.
// `monocromatico` = versão preta para impressão (OS, holerite, etiqueta).
export function Logo({
  tamanho = 32,
  legenda = false,
  monocromatico = false,
  className = '',
}: {
  /** Altura do monograma em px; texto e espaçamento acompanham. */
  tamanho?: number;
  legenda?: boolean;
  monocromatico?: boolean;
  className?: string;
}) {
  const corMarca = monocromatico ? 'text-black' : 'text-brand';
  const corPalavra = monocromatico ? 'text-black' : 'text-ink';
  const corIfy = monocromatico ? 'text-black' : 'text-brand-ink';
  const corLegenda = monocromatico ? 'text-black' : 'text-ink-muted';
  const fontePalavra = Math.max(12, Math.round(tamanho * (legenda ? 0.6 : 0.68)));
  const fonteLegenda = Math.max(12, Math.round(tamanho * 0.2));
  return (
    <span role="img" aria-label="Mecanify" className={`inline-flex items-center ${className}`} style={{ gap: Math.round(tamanho * 0.32) }}>
      <BrandMark tamanho={tamanho} className={corMarca} decorativo />
      <span className="flex flex-col" style={{ gap: Math.round(tamanho * 0.1) }}>
        <span translate="no" className={`font-semibold leading-none tracking-[-0.02em] ${corPalavra}`} style={{ fontSize: fontePalavra }}>
          mecan<span className={corIfy}>ify</span>
        </span>
        {legenda && (
          <span className={`font-medium uppercase leading-none tracking-[0.2em] ${corLegenda}`} style={{ fontSize: fonteLegenda }}>
            GESTÃO DE OS
          </span>
        )}
      </span>
    </span>
  );
}
