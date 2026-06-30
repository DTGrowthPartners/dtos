import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Status {
  plan: string;
  authenticated: boolean;
  hasToken: boolean;
  expiresInMin: number | null;
  usagePct: number | null;
}

const CLAUDE = '#D97757';

function ClaudeMark({ size = 30 }: { size?: number }) {
  const rays = Array.from({ length: 16 });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ color: CLAUDE }}>
      {rays.map((_, i) => {
        const a = (i * 22.5 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 3.4} y1={12 + Math.sin(a) * 3.4}
            x2={12 + Math.cos(a) * 10.6} y2={12 + Math.sin(a) * 10.6}
            stroke="currentColor" strokeWidth={2.1} strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export default function AiUsageWidget() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiClient.get<Status>('/api/ai-usage').then(setS).catch(() => setS(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (!s && loading) return null;

  const ok = !!s?.authenticated;
  const pct = s?.usagePct;                       // % de uso real (si el backend lo expone)
  const barColor = ok ? CLAUDE : '#ef4444';
  const BARS = 30;
  // Si hay % real, llena según el uso; si no, la barra refleja el estado de sesión.
  const filled = pct != null ? Math.round((pct / 100) * BARS) : ok ? BARS : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <ClaudeMark />
          <div className="leading-tight">
            <p className="font-semibold">Claude</p>
            <p className="text-xs text-muted-foreground">{s?.plan || 'Max (20x)'}</p>
          </div>

          <div className="flex-1 flex items-center justify-end gap-[3px] h-7 overflow-hidden">
            {Array.from({ length: BARS }).map((_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  height: '100%',
                  background: pct != null ? (i < filled ? barColor : 'hsl(var(--muted))') : barColor,
                  opacity: pct != null ? 1 : ok ? (i >= BARS - 2 ? 0.4 : 1) : 0.5,
                }}
              />
            ))}
          </div>

          <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className={ok ? 'text-emerald-500' : 'text-red-500'}>
            {ok ? '● Sesión activa' : '● Sin sesión'}
            {pct != null && <span className="text-muted-foreground"> · {pct}% del límite</span>}
            {ok && s?.expiresInMin != null && s.expiresInMin > 0 && (
              <span className="text-muted-foreground"> · token {Math.floor(s.expiresInMin / 60)}h{s.expiresInMin % 60}m</span>
            )}
          </span>
        </div>

        {!ok && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300">
              Claude no tiene sesión iniciada en el VPS (token vacío) — María puede fallar. Hay que re-loguear la suscripción.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
