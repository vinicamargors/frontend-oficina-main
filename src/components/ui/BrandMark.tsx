// Chave combinada estilizada (boca aberta + cabo diagonal) sobre quadrado âmbar. Sem cor fixa: usa tokens.
export function BrandMark({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-brand text-on-brand"
      style={{ width: tamanho, height: tamanho }}
      role="img"
      aria-label="Mecanify"
    >
      <svg viewBox="0 0 24 24" width={tamanho * 0.62} height={tamanho * 0.62} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15.5 4.5a4 4 0 0 0-4.2 5.4L4.8 16.4a1.8 1.8 0 0 0 2.6 2.6l6.5-6.5a4 4 0 0 0 5.4-4.2l-2.4 2.4-2.2-.4-.4-2.2z" />
      </svg>
    </span>
  );
}
