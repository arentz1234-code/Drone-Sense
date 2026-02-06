'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular' | 'chart';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  count = 1
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'chart':
        return 'rounded-lg';
      default:
        return 'rounded-md';
    }
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`skeleton-shimmer bg-[var(--bg-tertiary)] ${getVariantClasses()} ${className}`}
      style={style}
    />
  ));

  return count === 1 ? skeletons[0] : <>{skeletons}</>;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`terminal-card ${className}`}>
      <div className="terminal-header">
        <div className="terminal-dot red"></div>
        <div className="terminal-dot yellow"></div>
        <div className="terminal-dot green"></div>
        <Skeleton variant="text" width={120} className="ml-2" />
      </div>
      <div className="terminal-body space-y-4">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rectangular" height={100} />
      </div>
    </div>
  );
}

export function SkeletonChart({ height = 200, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <Skeleton variant="text" width="40%" height={20} />
      <Skeleton variant="chart" height={height} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} variant="text" width={`${100 / cols}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3">
          {Array.from({ length: cols }, (_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
      <Skeleton variant="text" width="50%" height={12} className="mb-2" />
      <Skeleton variant="text" width="80%" height={28} className="mb-1" />
      <Skeleton variant="text" width="30%" height={12} />
    </div>
  );
}
