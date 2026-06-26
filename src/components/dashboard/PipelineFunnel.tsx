import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Filter } from 'lucide-react';

interface Deal { id: string; estimatedValue?: number; probability?: number; stageId: string }
interface Stage { id: string; name: string; slug: string; color: string; position: number; isWon: boolean; isLost: boolean }

const fmtM = (n: number) => (Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1000) + 'K');

export default function PipelineFunnel() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [winRate, setWinRate] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<Deal[]>('/api/crm/deals').then(setDeals).catch(() => {});
    apiClient.get<Stage[]>('/api/crm/stages').then(setStages).catch(() => {});
    apiClient.get<{ winRate: number }>('/api/crm/metrics/performance').then((p) => setWinRate(p.winRate)).catch(() => {});
  }, []);

  const model = useMemo(() => {
    // Etapas del embudo: todas menos "Perdido", ordenadas por posición.
    const funnelStages = [...stages].filter((s) => !s.isLost).sort((a, b) => a.position - b.position);
    const rows = funnelStages.map((s) => {
      const ds = deals.filter((d) => d.stageId === s.id);
      return { name: s.name, color: s.color, count: ds.length, value: ds.reduce((sum, d) => sum + (d.estimatedValue || 0), 0), isWon: s.isWon };
    });
    const maxCount = Math.max(1, ...rows.map((r) => r.count));
    const totalCount = rows.reduce((a, r) => a + r.count, 0);
    const valorBruto = rows.reduce((a, r) => a + r.value, 0);
    const ponderado = deals.reduce((a, d) => a + (d.estimatedValue || 0) * ((d.probability ?? 50) / 100), 0);
    return { rows, maxCount, totalCount, valorBruto, ponderado };
  }, [deals, stages]);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        <Filter className="h-3.5 w-3.5" /> Embudo de conversión
      </div>
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-lg font-bold">{model.totalCount} oportunidades activas</h3>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="text-muted-foreground">Valor bruto <b className="text-foreground">{fmtM(model.valorBruto)}</b></span>
              <span className="text-muted-foreground">Ponderado <b className="text-sky-400">{fmtM(model.ponderado)}</b></span>
              {winRate !== null && <span className="text-muted-foreground">Cierre global <b className="text-violet-400">{Math.round(winRate)}%</b></span>}
            </div>
          </div>

          <div className="space-y-2">
            {model.rows.map((r, i) => {
              const prev = i > 0 ? model.rows[i - 1] : null;
              const conv = prev && prev.count > 0 && !r.isWon ? Math.round((r.count / prev.count) * 100) : null;
              const widthPct = Math.max(8, (r.count / model.maxCount) * 100);
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-28 sm:w-36 text-sm text-right text-muted-foreground shrink-0">{r.name}</span>
                  <div className="flex-1 min-w-0 h-9 rounded-md bg-muted/40 relative overflow-hidden">
                    <div
                      className="h-full rounded-md flex items-center justify-between px-3 transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: r.color }}
                    >
                      <span className="text-sm font-semibold text-white whitespace-nowrap">{r.count} deals</span>
                      <span className="text-xs text-white/90 whitespace-nowrap ml-2">{fmtM(r.value)}</span>
                    </div>
                  </div>
                  <span className="w-12 text-sm text-right shrink-0 text-emerald-500">
                    {conv !== null ? `↓${conv}%` : '↓—'}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
