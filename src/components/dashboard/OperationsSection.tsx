import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { loadTasks, loadProjects } from '@/lib/firestoreTaskService';
import type { Task, Project } from '@/types/taskTypes';
import { Activity, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area,
} from 'recharts';

const C = { grey: '#9ca3af', orange: '#f59e0b', green: '#65a30d', red: '#ef4444', blue: '#3b82f6', donut: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#9ca3af', '#ec4899', '#06b6d4', '#a3a3a3'] };
const isDone = (s?: string) => /done|complet/i.test(s || '');
const isInProgress = (s?: string) => /progress|curso/i.test(s || '');
const DAY = 86400000;

export default function OperationsSection() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadTasks().then((t) => setTasks(t.filter((x) => !x.deletedAt))).catch(() => {});
    loadProjects().then(setProjects).catch(() => {});
  }, []);

  const m = useMemo(() => {
    const now = Date.now();
    const projName = (id?: string) => projects.find((p) => p.id === id)?.name || 'Sin proyecto';
    const active = tasks.filter((t) => !isDone(t.status));
    const vencidas = active.filter((t) => t.dueDate && t.dueDate < now);

    // Entregas esta semana (próximos 7 días, activas)
    const entregasSemana = active.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= now + 7 * DAY);

    // Cumplimiento on-time (de tareas hechas con fecha límite)
    const doneWithDue = tasks.filter((t) => isDone(t.status) && t.dueDate && t.completedAt);
    const onTimeCount = doneWithDue.filter((t) => (t.completedAt as number) <= (t.dueDate as number)).length;
    const onTimePct = doneWithDue.length ? Math.round((onTimeCount / doneWithDue.length) * 100) : 0;

    // Pendientes por cliente/proyecto (top 6)
    const byClient: Record<string, number> = {};
    active.forEach((t) => { const n = projName(t.projectId); byClient[n] = (byClient[n] || 0) + 1; });
    const pendientesPorCliente = Object.entries(byClient).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Tareas por estado y proyecto (top 5 proyectos por total)
    const byProj: Record<string, { todo: number; prog: number; done: number; total: number }> = {};
    tasks.forEach((t) => {
      const n = projName(t.projectId);
      if (!byProj[n]) byProj[n] = { todo: 0, prog: 0, done: 0, total: 0 };
      if (isDone(t.status)) byProj[n].done++;
      else if (isInProgress(t.status)) byProj[n].prog++;
      else byProj[n].todo++;
      byProj[n].total++;
    });
    const porEstadoProyecto = Object.entries(byProj).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 5);

    // Carga por persona (activas, apiladas: todo/prog/vencida)
    const byPerson: Record<string, { todo: number; prog: number; venc: number; total: number }> = {};
    active.forEach((t) => {
      const p = t.assignee || 'Sin asignar';
      if (!byPerson[p]) byPerson[p] = { todo: 0, prog: 0, venc: 0, total: 0 };
      if (t.dueDate && t.dueDate < now) byPerson[p].venc++;
      else if (isInProgress(t.status)) byPerson[p].prog++;
      else byPerson[p].todo++;
      byPerson[p].total++;
    });
    const cargaPorPersona = Object.entries(byPerson).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 6);
    const saturado = cargaPorPersona.find((p) => p.total >= 15);

    // Entregas próximos 7 días (por día)
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const proximos7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today0.getTime() + i * DAY);
      const start = d.getTime(), end = start + DAY;
      const count = active.filter((t) => t.dueDate && t.dueDate >= start && t.dueDate < end).length;
      return { label: i === 0 ? 'Hoy' : dayLabels[d.getDay()], count, i };
    });

    // Tareas por tipo de trabajo
    const byType: Record<string, number> = {};
    active.forEach((t) => { const n = t.type || 'Sin tipo'; byType[n] = (byType[n] || 0) + 1; });
    const porTipo = Object.entries(byType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Cumplimiento on-time · 8 semanas
    const onTime8 = Array.from({ length: 8 }, (_, idx) => {
      const w = 7 - idx; // 7..0 (más viejo -> más nuevo)
      const start = now - (w + 1) * 7 * DAY, end = now - w * 7 * DAY;
      const wk = doneWithDue.filter((t) => (t.completedAt as number) >= start && (t.completedAt as number) < end);
      const ot = wk.filter((t) => (t.completedAt as number) <= (t.dueDate as number)).length;
      return { label: `S${idx + 1}`, pct: wk.length ? Math.round((ot / wk.length) * 100) : null };
    });

    return { activeCount: active.length, vencidasCount: vencidas.length, entregasSemana: entregasSemana.length, onTimePct, pendientesPorCliente, porEstadoProyecto, cargaPorPersona, saturado, proximos7, porTipo, onTime8 };
  }, [tasks, projects]);

  const Kpi = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <Card><CardContent className="pt-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color || ''}`}>{value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Activity className="h-3.5 w-3.5" /> Operación — carga y entregas
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Tareas activas" value={m.activeCount} />
        <Kpi label="Vencidas" value={m.vencidasCount} color="text-red-500" />
        <Kpi label="Entregas esta semana" value={m.entregasSemana} color="text-amber-500" />
        <Kpi label="Cumplimiento on-time" value={`${m.onTimePct}%`} color={m.onTimePct >= 75 ? 'text-emerald-500' : 'text-amber-500'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Pendientes por cliente */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold">Tareas pendientes por cliente</h3><span className="text-xs text-muted-foreground">dónde está la carga</span></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.pendientesPorCliente} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill={C.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        {/* Por estado y proyecto */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold">Tareas por estado y proyecto</h3><span className="text-xs text-muted-foreground">flujo de trabajo</span></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.porEstadoProyecto} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="todo" stackId="a" name="Por hacer" fill={C.grey} />
                <Bar dataKey="prog" stackId="a" name="En curso" fill={C.orange} />
                <Bar dataKey="done" stackId="a" name="Hechas" fill={C.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        {/* Carga por persona */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Carga por persona</h3>
            {m.saturado && <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {m.saturado.name} saturado</span>}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.cargaPorPersona} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="todo" stackId="a" name="Por hacer" fill={C.grey} />
                <Bar dataKey="prog" stackId="a" name="En curso" fill={C.orange} />
                <Bar dataKey="venc" stackId="a" name="Vencidas" fill={C.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        {/* Entregas próximos 7 días */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold">Entregas próximos 7 días</h3><span className="text-xs text-muted-foreground">qué cae y cuándo</span></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.proximos7} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {m.proximos7.map((d) => <Cell key={d.i} fill={d.i === 0 ? C.red : d.i === 1 ? C.orange : C.blue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>

        {/* Tipo de trabajo (donut) */}
        <Card><CardContent className="pt-4">
          <h3 className="font-bold mb-2">Tareas por tipo de trabajo</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={m.porTipo} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {m.porTipo.map((_, i) => <Cell key={i} fill={C.donut[i % C.donut.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs">
            {m.porTipo.map((t, i) => (
              <span key={t.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.donut[i % C.donut.length] }} />{t.name} {t.value}</span>
            ))}
          </div>
        </CardContent></Card>

        {/* On-time 8 semanas */}
        <Card><CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2"><h3 className="font-bold">Cumplimiento on-time · 8 semanas</h3><span className="text-xs text-emerald-500">↗ tendencia</span></div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.onTime8} margin={{ left: -10 }}>
                <defs><linearGradient id="gOt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} /><stop offset="95%" stopColor="#84cc16" stopOpacity={0.03} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'On-time']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="pct" stroke="#84cc16" strokeWidth={2.5} fill="url(#gOt)" connectNulls dot={{ r: 3, fill: '#84cc16' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
