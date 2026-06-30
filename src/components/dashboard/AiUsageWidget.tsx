import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { BarChart, Bar, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Usage {
  today: number; thisWeek: number; lastWeek: number; total: number;
  weekly: { label: string; count: number }[];
}

export default function AiUsageWidget() {
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => { apiClient.get<Usage>('/api/ai-usage').then(setU).catch(() => {}); }, []);
  if (!u) return null;

  const delta = u.lastWeek ? Math.round((u.thisWeek / u.lastWeek - 1) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-400" /> Consumo de IA · semanal</h3>
          <span className="text-xs text-muted-foreground">{u.total.toLocaleString('es-CO')} interacciones · María</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Esta semana</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">{u.thisWeek}</p>
            <p className={`text-xs ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{delta >= 0 ? '+' : ''}{delta}% vs anterior</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hoy</p>
            <p className="text-2xl font-bold tabular-nums leading-tight">{u.today}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sem. pasada</p>
            <p className="text-2xl font-bold tabular-nums leading-tight text-muted-foreground">{u.lastWeek}</p>
          </div>
        </div>

        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={u.weekly} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                formatter={(v: number) => [`${v} interacciones`, 'IA']}
                labelFormatter={(l) => `Semana del ${l}`}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {u.weekly.map((_, i) => (
                  <Cell key={i} fill={i === u.weekly.length - 1 ? '#8b5cf6' : 'rgba(139,92,246,0.45)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
