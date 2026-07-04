export function Skeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-pulse"
          style={{
            background: "linear-gradient(90deg, #DFC08A 0%, #EDE1CC 100%)",
          }}
        />
      ))}
    </div>
  );
}