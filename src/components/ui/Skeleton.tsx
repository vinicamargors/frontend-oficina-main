export function Skeleton({ linhas = 1, className = '' }: { linhas?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-4 rounded-md bg-muted animate-pulse motion-reduce:animate-none" style={i === linhas - 1 && linhas > 1 ? { width: '60%' } : undefined} />
      ))}
    </div>
  );
}
