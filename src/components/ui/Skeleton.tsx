export function Skeleton({ linhas = 1, className = '' }: { linhas?: number; className?: string }) {
  return (
    <div role="status" className={`flex flex-col gap-2 ${className}`}>
      <span className="sr-only">Carregando</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-4 rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
          style={i === linhas - 1 && linhas > 1 ? { width: '60%' } : undefined}
        />
      ))}
    </div>
  );
}
