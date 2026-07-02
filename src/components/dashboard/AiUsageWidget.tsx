import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Status {
  plan: string;
  authenticated: boolean;
  hasToken: boolean;
  expiresInMin: number | null;
  pct5h: number | null;
  pct7d: number | null;
  reset5h: number | null; // unix seconds
  reset7d: number | null;
}

const CLAUDE = '#D97757';
const usageColor = (p: number) => (p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : CLAUDE);

const fmtReset = (unixSec: number | null) => {
  if (!unixSec) return '';
  const ms = unixSec * 1000 - Date.now();
  if (ms <= 0) return 'ahora';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

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

  const load = (force = false) => {
    setLoading(true);
    apiClient.get<Status>(`/api/ai-usage${force ? '?force=1' : ''}`).then(setS).catch(() => setS(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (!s && loading) return null;

  const ok = !!s?.authenticated;

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="py-3">
        <div className="flex items-center gap-2.5">
          <ClaudeMark size={26} />
          <div className="leading-tight flex-1 min-w-0">
            <p className="font-semibold text-sm">Claude</p>
            <p className="text-[11px] text-muted-foreground">{s?.plan || 'Max (20x)'}</p>
          </div>
          <button onClick={() => load(true)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Actualizar uso">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {ok ? (
          <div className="mt-3 space-y-2">
            <Meter label="5h" pct={s?.pct5h ?? null} reset={s?.reset5h ?? null} />
            <Meter label="Semana" pct={s?.pct7d ?? null} reset={s?.reset7d ?? null} />
          </div>
        ) : (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-300">Claude no tiene sesión iniciada en el VPS — hay que re-loguear la suscripción.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Barra de uso compacta (etiqueta + barritas + % + reset).
function Meter({ label, pct, reset }: { label: string; pct: number | null; reset: number | null }) {
  const BARS = 22;
  const has = pct != null;
  const color = has ? usageColor(pct) : 'hsl(var(--muted))';
  const filled = has ? Math.max(pct > 0 ? 1 : 0, Math.round((pct / 100) * BARS)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="flex-1 flex items-center gap-[2px] h-4 overflow-hidden">
        {Array.from({ length: BARS }).map((_, i) => (
          <span key={i} className="flex-1 rounded-full" style={{ height: '100%', background: i < filled ? color : 'hsl(var(--muted))' }} />
        ))}
      </div>
      <span className="w-24 shrink-0 text-right text-[11px] font-medium" style={{ color: has ? color : undefined }}>
        {has ? `${pct}%` : '—'}
        {reset ? <span className="text-muted-foreground font-normal"> · {fmtReset(reset)}</span> : null}
      </span>
    </div>
  );
}
