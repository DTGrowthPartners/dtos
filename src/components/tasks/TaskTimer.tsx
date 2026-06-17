import { useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskTimerProps {
  trackedMs?: number;
  trackingStartedAt?: number | null;
  /** Persiste los cambios (trackedMs / trackingStartedAt) en la tarea. */
  onChange: (updates: { trackedMs: number; trackingStartedAt: number | null }) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Formatea ms a "Xh Ym" / "Ym Zs" / "Zs". */
const fmt = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

/**
 * Cronómetro compacto por tarea. Play acumula tiempo; Pause lo congela.
 * Mientras corre, refresca el display cada segundo (solo local). El estado real
 * vive en la tarea (trackedMs acumulado + trackingStartedAt cuando corre).
 */
export default function TaskTimer({ trackedMs = 0, trackingStartedAt, onChange, size = 'sm', className }: TaskTimerProps) {
  const running = !!trackingStartedAt;
  const [, setTick] = useState(0);

  // Refresca el display cada segundo mientras corre.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const displayMs = trackedMs + (running && trackingStartedAt ? Date.now() - trackingStartedAt : 0);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running && trackingStartedAt) {
      // Pausar: acumula lo transcurrido
      onChange({ trackedMs: trackedMs + (Date.now() - trackingStartedAt), trackingStartedAt: null });
    } else {
      // Iniciar
      onChange({ trackedMs, trackingStartedAt: Date.now() });
    }
  };

  const hasTime = displayMs > 0;
  const dim = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <button
      type="button"
      onClick={toggle}
      draggable={false}
      title={running ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors border',
        running
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
          : hasTime
            ? 'border-border bg-muted/40 text-foreground hover:bg-muted'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
    >
      {running ? <Pause className={cn(dim, 'fill-current')} /> : <Play className={cn(dim, hasTime && 'fill-current')} />}
      {(hasTime || running) && <span>{fmt(displayMs)}</span>}
    </button>
  );
}
