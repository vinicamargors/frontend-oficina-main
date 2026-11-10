// Monograma do Mecanify, vetorizado do logo do dono (docs/brand/mecanify-logo-referencia.jpg):
// dois laços de traço arredondado formando o "M" e uma chave de boca cruzando na diagonal.
// Os cortes nos laços (onde a chave passa por cima) são extremidades retas do próprio traço.
// Sem cor fixa: tudo em currentColor; a cor vem da classe (padrão `text-brand`).
export const MONOGRAMA = {
  viewBox: '0 0 52 37.4',
  largura: 52,
  altura: 37.4,
  traco: 3.8,
  laco: [
    'M21 14.5L10.7 3.7A5.1 5.1 0 0 0 1.9 7.2L1.9 29.9A5.4 5.4 0 0 0 11 33.8L13.9 31.1',
    'M29 23.1L38.9 33.4A6.5 6.5 0 0 0 50.1 28.9L50.1 11.1A4.1 4.1 0 0 0 46.1 7',
  ],
  chave:
    'M12.2 30C13 29.2 12.5 26.6 13.3 25.9L28.8 11A8.1 8.1 0 0 1 39.1 .5L33.7 5.6L34.9 9.6L38.8 10.9L44.2 5.8A8.1 8.1 0 0 1 32.9 15.4L14.9 32.7Z',
} as const;

export function BrandMark({
  tamanho = 32,
  className = 'text-brand',
  titulo = 'Mecanify',
  decorativo = false,
}: {
  /** Altura em px; a largura segue a proporção do monograma. */
  tamanho?: number;
  className?: string;
  titulo?: string;
  /** Dentro de `Logo`, o nome acessível fica no conjunto e o monograma é escondido. */
  decorativo?: boolean;
}) {
  const largura = Math.round((tamanho * MONOGRAMA.largura) / MONOGRAMA.altura * 10) / 10;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MONOGRAMA.viewBox}
      width={largura}
      height={tamanho}
      className={`shrink-0 ${className}`}
      {...(decorativo ? { 'aria-hidden': true, focusable: 'false' as const } : { role: 'img', 'aria-label': titulo })}
    >
      <g fill="none" stroke="currentColor" strokeWidth={MONOGRAMA.traco}>
        {MONOGRAMA.laco.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path fill="currentColor" d={MONOGRAMA.chave} />
    </svg>
  );
}
