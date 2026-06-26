import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Target, Clock, Trophy, XCircle, AlertTriangle } from 'lucide-react';
import PipelineFunnel from '@/components/dashboard/PipelineFunnel';

interface Props {
  deals: any[];
  stages: any[];
  formatCurrency: (n?: number, c?: string) => string;
}

interface Perf {
  winRate: number;
  averageSalesCycle: number;
  totalWon: number;
  totalLost: number;
  wonValue: number;
  lostReasons: { reason: string; count: number; percentage: number }[];
}

// Meta mensual del pipeline (brief MEJORAS 2 — bloque 6)
const META_MENSUAL = 25_000_000;

const REASON_LABELS: Record<string, string> = {
  precio: 'Precio muy alto',
  competencia: 'Eligió competencia',
  timing: 'No es el momento',
  no_necesita: 'No necesita',
  sin_respuesta: 'No respondió',
  no_califica: 'No califica',
  otro: 'Otro',
};

export default function PipelineAnalytics({ deals, stages, formatCurrency }: Props) {
  const [perf, setPerf] = useState<Perf | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Perf>('/api/crm/metrics/performance')
      .then(setPerf)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeStages = useMemo(() => stages.filter((s) => !s.isWon && !s.isLost), [stages]);
  const openDeals = useMemo(() => {
    const closedIds = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.id));
    return deals.filter((d) => !closedIds.has(d.stageId));
  }, [deals, stages]);

  const forecast = useMemo(
    () => openDeals.reduce((sum, d) => sum + (d.estimatedValue || 0) * ((d.probability ?? 50) / 100), 0),
    [openDeals]
  );
  const sinSeguimiento = useMemo(() => openDeals.filter((d) => !d.nextFollowUp).length, [openDeals]);
  const maxStageCount = useMemo(
    () => Math.max(1, ...activeStages.map((s) => deals.filter((d) => d.stageId === s.id).length)),
    [activeStages, deals]
  );

  const forecastPct = Math.round((forecast / META_MENSUAL) * 100);
  const forecastColor =
    forecast >= META_MENSUAL ? 'text-green-600' : forecast >= META_MENSUAL * 0.8 ? 'text-yellow-600' : 'text-red-600';

  if (loading) return <div className="text-center py-12 text-muted-foreground">Cargando analítica…</div>;

  return (
    <div className="space-y-6">
      {/* Embudo de conversión (mismo del dashboard) */}
      <PipelineFunnel />

      {/* KPIs estrella */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Win rate</span>
            </div>
            <p className="text-2xl font-bold">{perf ? perf.winRate.toFixed(0) : '0'}%</p>
            <p className="text-xs text-muted-foreground">
              {perf?.totalWon || 0} ganados · {perf?.totalLost || 0} perdidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ciclo de venta</span>
            </div>
            <p className="text-2xl font-bold">
              {perf ? Math.round(perf.averageSalesCycle) : 0}
              <span className="text-base font-normal"> días</span>
            </p>
            <p className="text-xs text-muted-foreground">promedio (ganados)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Forecast ponderado</span>
            </div>
            <p className={`text-2xl font-bold ${forecastColor}`}>{formatCurrency(forecast)}</p>
            <p className="text-xs text-muted-foreground">
              {forecastPct}% de la meta ({formatCurrency(META_MENSUAL)})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sin próximo paso</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {sinSeguimiento}
              <span className="text-base font-normal"> / {openDeals.length}</span>
            </p>
            <p className="text-xs text-muted-foreground">deals abiertos sin seguimiento</p>
          </CardContent>
        </Card>
      </div>

      {/* Embudo por etapa */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Embudo por etapa
          </h3>
          <div className="space-y-2">
            {activeStages.map((s) => {
              const ds = deals.filter((d) => d.stageId === s.id);
              const val = ds.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-sm w-32 sm:w-40 truncate">{s.name}</span>
                  <div className="flex-1 bg-muted rounded h-6 overflow-hidden min-w-[40px]">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(ds.length / maxStageCount) * 100}%`, backgroundColor: s.color }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{ds.length}</span>
                  <span className="text-xs text-muted-foreground w-24 sm:w-28 text-right">{formatCurrency(val)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Razones de pérdida */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> Razones de pérdida (últimos 90 días)
          </h3>
          {perf && perf.lostReasons.length ? (
            <div className="space-y-2">
              {[...perf.lostReasons].sort((a, b) => b.count - a.count).map((r) => (
                <div key={r.reason} className="flex items-center gap-3">
                  <span className="text-sm w-32 sm:w-40 truncate">{REASON_LABELS[r.reason] || r.reason}</span>
                  <div className="flex-1 bg-muted rounded h-5 overflow-hidden min-w-[40px]">
                    <div className="h-full bg-red-400 rounded" style={{ width: `${r.percentage}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{r.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pérdidas registradas en el periodo.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
