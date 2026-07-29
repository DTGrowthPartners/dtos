import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, CalendarCheck, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { loadTasks, loadCompletedTasks } from '@/lib/firestoreTaskService';
import type { Task } from '@/types/taskTypes';

/**
 * Métricas de productividad del tablero: cuántas tareas se hacen por día /
 * semana / mes, cuántas faltan y quién las hace.
 *
 * Fuente: colección 'tasks' + 'completed_tasks'. Las completadas del tablero se
 * COPIAN a completed_tasks con originalId, así que se deduplica por ese campo
 * para no contar dos veces la misma tarea.
 */

const MES_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

interface DoneEvent { at: number; assignee: string }

export default function TaskMetrics() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [completed, setCompleted] = useState<Task[] | null>(null);

  useEffect(() => {
    Promise.all([loadTasks(), loadCompletedTasks()])
      .then(([t, c]) => { setTasks(t); setCompleted(c); })
      .catch(() => { setTasks([]); setCompleted([]); });
  }, []);

  const m = useMemo(() => {
    if (!tasks || !completed) return null;

    // Historial de completadas (dedupe: completed_tasks manda; las DONE del
    // tablero que no fueron copiadas también cuentan)
    const originalIds = new Set(completed.map((c: any) => c.originalId).filter(Boolean));
    const doneEvents: DoneEvent[] = [
      ...completed.map((c: any) => ({ at: c.completedAt as number, assignee: c.assignee || 'Sin asignar' })),
      ...tasks
        .filter((t: any) => t.status === 'DONE' && !originalIds.has(t.id))
        .map((t: any) => ({ at: (t.completedAt || t.createdAt) as number, assignee: t.assignee || 'Sin asignar' })),
    ].filter((e) => typeof e.at === 'number' && e.at > 0);

    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const lunes = new Date(hoy0); lunes.setDate(hoy0.getDate() - ((hoy0.getDay() + 6) % 7));
    const lunesPasado = new Date(lunes); lunesPasado.setDate(lunes.getDate() - 7);
    const mes0 = new Date(hoy0.getFullYear(), hoy0.getMonth(), 1);
    const mesPasado0 = new Date(hoy0.getFullYear(), hoy0.getMonth() - 1, 1);

    const en = (from: Date, to?: Date) =>
      doneEvents.filter((e) => e.at >= from.getTime() && (!to || e.at < to.getTime()));

    const hechasHoy = en(hoy0).length;
    const semana = en(lunes);
    const semanaPasada = en(lunesPasado, lunes).length;
    const mes = en(mes0);
    const mesPasado = en(mesPasado0, mes0).length;

    const abiertas = tasks.filter((t: any) => t.status !== 'DONE');
    const enProgreso = abiertas.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const vencidas = abiertas.filter((t: any) => t.dueDate && t.dueDate < Date.now()).length;

    // Creadas este mes (tablero + completadas cuyo original ya no está en el tablero)
    const idsTablero = new Set(tasks.map((t) => t.id));
    const creadasMes = [
      ...tasks,
      ...completed.filter((c: any) => !c.originalId || !idsTablero.has(c.originalId)),
    ].filter((t: any) => t.createdAt && t.createdAt >= mes0.getTime()).length;

    // Últimas 8 semanas (la actual de última)
    const semanas = Array.from({ length: 8 }, (_, i) => {
      const ini = new Date(lunes); ini.setDate(lunes.getDate() - 7 * (7 - i));
      const fin = new Date(ini); fin.setDate(ini.getDate() + 7);
      return {
        label: `${ini.getDate()} ${MES_S[ini.getMonth()]}`,
        hechas: en(ini, fin).length,
        actual: i === 7,
      };
    });
    const promedioSemana = Math.round((semanas.slice(0, 7).reduce((a, s) => a + s.hechas, 0) / 7) * 10) / 10;

    // Por persona: hechas (semana/mes) + abiertas
    const personas = new Map<string, { sem: number; mes: number; abiertas: number }>();
    const p = (n: string) => { if (!personas.has(n)) personas.set(n, { sem: 0, mes: 0, abiertas: 0 }); return personas.get(n)!; };
    semana.forEach((e) => { p(e.assignee).sem++; });
    mes.forEach((e) => { p(e.assignee).mes++; });
    abiertas.forEach((t: any) => { p(t.assignee || 'Sin asignar').abiertas++; });
    const porPersona = Array.from(personas.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.mes - a.mes || b.abiertas - a.abiertas);

    return { hechasHoy, semana: semana.length, semanaPasada, mes: mes.length, mesPasado, abiertas: abiertas.length, enProgreso, vencidas, creadasMes, semanas, promedioSemana, porPersona };
  }, [tasks, completed]);

  if (!m) {
    return (
      <Card><CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando métricas…
      </CardContent></Card>
    );
  }

  const delta = (actual: number, anterior: number) => {
    if (!anterior) return null;
    const d = Math.round(((actual - anterior) / anterior) * 100);
    if (d === 0) return null;
    return <span className={`text-xs ml-1 ${d > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{d > 0 ? '↑' : '↓'}{Math.abs(d)}%</span>;
  };

  const kpis = [
    { icon: CalendarCheck, label: 'Hechas hoy', value: String(m.hechasHoy), cls: 'text-emerald-500' },
    { icon: CheckCircle2, label: 'Esta semana', value: String(m.semana), extra: delta(m.semana, m.semanaPasada), sub: `sem. pasada: ${m.semanaPasada}`, cls: 'text-emerald-500' },
    { icon: CheckCircle2, label: 'Este mes', value: String(m.mes), extra: delta(m.mes, m.mesPasado), sub: `mes pasado: ${m.mesPasado} · creadas: ${m.creadasMes}`, cls: 'text-emerald-500' },
    { icon: Clock, label: 'Abiertas', value: String(m.abiertas), sub: `${m.enProgreso} en progreso`, cls: 'text-blue-500' },
    { icon: AlertTriangle, label: 'Vencidas', value: String(m.vencidas), cls: m.vencidas > 0 ? 'text-red-500' : 'text-emerald-500' },
    { icon: TrendingUp, label: 'Ritmo', value: `${m.promedioSemana}/sem`, sub: 'promedio 7 semanas', cls: 'text-violet-500' },
  ];

  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <k.icon className={`h-3.5 w-3.5 ${k.cls}`} /> {k.label}
              </p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">{k.value}{'extra' in k ? k.extra : null}</p>
              {'sub' in k && k.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Completadas por semana */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Completadas por semana <span className="font-normal normal-case">(inicio de cada semana)</span>
            </p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.semanas} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 text-xs shadow-md">
                          <span className="text-muted-foreground">Semana del {label}: </span>
                          <span className="font-semibold">{payload[0].value} tareas</span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="hechas" radius={[4, 4, 0, 0]}>
                    {m.semanas.map((s, i) => (
                      <Cell key={i} fill={s.actual ? '#8b5cf6' : '#22c55e'} opacity={s.actual ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">La barra violeta es la semana en curso (aún incompleta).</p>
          </div>

          {/* Por persona */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Por persona</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                    <th className="text-left font-medium px-3 py-2">Persona</th>
                    <th className="text-right font-medium px-3 py-2">Semana</th>
                    <th className="text-right font-medium px-3 py-2">Mes</th>
                    <th className="text-right font-medium px-3 py-2">Abiertas</th>
                  </tr>
                </thead>
                <tbody>
                  {m.porPersona.map((pp) => (
                    <tr key={pp.nombre} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{pp.nombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-500">{pp.sem}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pp.mes}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-500">{pp.abiertas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
