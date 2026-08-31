import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Clock, AlertTriangle, Trophy, Phone, ChevronRight,
  Snowflake, CircleAlert, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Dashboard de quien vende. Lo ve todo el que NO tiene permiso de finanzas:
 * sus prospectos, a quien le toca escribirle hoy y que le falta a cada uno.
 * Ni ingresos, ni gastos, ni utilidad — eso es el dashboard financiero.
 */

interface Stage {
  id: string;
  name: string;
  slug: string;
  color?: string;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
}

interface Deal {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  stageId: string;
  stage?: Stage;
  estimatedValue?: number;
  serviceId?: string;
  ownerId?: string;
  owner?: { id: string; firstName?: string };
  nextFollowUp?: string;
  lastInteractionAt?: string;
  closedAt?: string;
  createdAt: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

const dias = (iso?: string): number | null =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

/** Fin del día de hoy: un seguimiento de hoy cuenta como "para hoy", no como vencido. */
const finDeHoy = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function DashboardComercial() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloMios, setSoloMios] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get<Stage[]>('/api/crm/stages').catch(() => [] as Stage[]),
      apiClient.get<Deal[]>('/api/crm/deals').catch(() => [] as Deal[]),
    ])
      .then(([s, d]) => {
        setStages(s || []);
        setDeals(d || []);
      })
      .finally(() => setCargando(false));
  }, []);

  // Si el usuario no tiene nada asignado, mostrarle todo: un panel vacío no sirve
  const propios = useMemo(() => deals.filter((d) => d.ownerId && d.ownerId === user?.id), [deals, user?.id]);
  const mostrarTodo = !soloMios || propios.length === 0;
  const mios = mostrarTodo ? deals : propios;

  const abiertos = useMemo(
    () => mios.filter((d) => !d.stage?.isWon && !d.stage?.isLost),
    [mios]
  );

  const hoy = finDeHoy();
  const paraHoy = useMemo(
    () =>
      abiertos
        .filter((d) => d.nextFollowUp && new Date(d.nextFollowUp) <= hoy)
        .sort((a, b) => new Date(a.nextFollowUp!).getTime() - new Date(b.nextFollowUp!).getTime()),
    [abiertos]
  );
  const vencidos = paraHoy.filter((d) => {
    const f = new Date(d.nextFollowUp!);
    f.setHours(23, 59, 59, 999);
    return f < finDeHoy() && (dias(d.nextFollowUp) ?? 0) > 0;
  });

  const faltaInfo = useMemo(
    () => abiertos.filter((d) => !d.serviceId || !d.estimatedValue || !d.ownerId),
    [abiertos]
  );

  const enfriandose = useMemo(
    () =>
      abiertos
        .filter((d) => (dias(d.lastInteractionAt) ?? 999) >= 14 && !d.nextFollowUp)
        .sort((a, b) => (dias(b.lastInteractionAt) ?? 0) - (dias(a.lastInteractionAt) ?? 0)),
    [abiertos]
  );

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const ganadosMes = useMemo(
    () => mios.filter((d) => d.stage?.isWon && d.closedAt && new Date(d.closedAt) >= inicioMes),
    [mios]
  );

  const valorEnJuego = abiertos.reduce((s, d) => s + (d.estimatedValue || 0), 0);

  const embudo = useMemo(() => {
    const activas = stages.filter((s) => !s.isWon && !s.isLost).sort((a, b) => a.position - b.position);
    return activas.map((s) => {
      const g = abiertos.filter((d) => d.stageId === s.id);
      return { ...s, count: g.length, valor: g.reduce((x, d) => x + (d.estimatedValue || 0), 0) };
    });
  }, [stages, abiertos]);

  const maxEmbudo = Math.max(1, ...embudo.map((e) => e.count));
  const irA = (id: string) => navigate(`/crm?deal=${id}`);

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { icono: TrendingUp, label: 'Valor en juego', valor: fmt(valorEnJuego), pie: `${abiertos.length} prospectos abiertos`, color: 'text-emerald-500' },
    { icono: Clock, label: 'Para contactar hoy', valor: String(paraHoy.length), pie: vencidos.length ? `${vencidos.length} ya vencidos` : 'al día', color: paraHoy.length ? 'text-amber-500' : 'text-muted-foreground' },
    { icono: CircleAlert, label: 'Les falta información', valor: String(faltaInfo.length), pie: 'no pueden avanzar de etapa', color: faltaInfo.length ? 'text-orange-500' : 'text-muted-foreground' },
    { icono: Trophy, label: 'Cerrados este mes', valor: String(ganadosMes.length), pie: fmt(ganadosMes.reduce((s, d) => s + (d.estimatedValue || 0), 0)), color: 'text-violet-500' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mostrarTodo && propios.length === 0
              ? 'Todavía no tenés prospectos asignados, así que ves todo el pipeline.'
              : 'Tu pipeline y lo que toca hacer hoy.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {propios.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSoloMios((v) => !v)}>
              {soloMios ? 'Ver todo el equipo' : 'Ver solo lo mío'}
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/crm')}>
            Abrir Ventas <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icono = k.icono;
          return (
            <Card key={k.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Icono className={cn('h-4 w-4', k.color)} />
                  {k.label}
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{k.valor}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.pie}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Para hoy */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-amber-500" />
              A quién escribirle hoy
              {paraHoy.length > 0 && <Badge variant="secondary">{paraHoy.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paraHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nada pendiente para hoy. Programá el siguiente contacto desde el clic derecho en cada tarjeta.
              </p>
            ) : (
              <div className="space-y-1">
                {paraHoy.slice(0, 10).map((d) => {
                  const atraso = dias(d.nextFollowUp) ?? 0;
                  return (
                    <button
                      key={d.id}
                      onClick={() => irA(d.id)}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.stage?.name}
                          {d.company ? ` · ${d.company}` : ''}
                        </p>
                      </div>
                      {d.estimatedValue ? (
                        <span className="hidden sm:block text-xs tabular-nums text-muted-foreground">
                          {fmt(d.estimatedValue)}
                        </span>
                      ) : null}
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-[11px]',
                          atraso > 0 ? 'border-destructive/40 text-destructive' : 'border-amber-500/40 text-amber-500'
                        )}
                      >
                        {atraso > 0 ? `${atraso}d tarde` : 'hoy'}
                      </Badge>
                    </button>
                  );
                })}
                {paraHoy.length > 10 && (
                  <p className="pt-2 text-xs text-muted-foreground">y {paraHoy.length - 10} más en Ventas</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Embudo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tu embudo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {embudo.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{e.name}</span>
                  <span className="tabular-nums font-medium">{e.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((e.count / maxEmbudo) * 100)}%`,
                      backgroundColor: e.color || 'hsl(var(--primary))',
                    }}
                  />
                </div>
                {e.valor > 0 && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{fmt(e.valor)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Falta informacion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Les falta información para avanzar
              {faltaInfo.length > 0 && <Badge variant="secondary">{faltaInfo.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {faltaInfo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos completos.</p>
            ) : (
              <div className="space-y-1">
                {faltaInfo.slice(0, 8).map((d) => {
                  const falta = [
                    !d.serviceId && 'servicio',
                    !d.estimatedValue && 'valor',
                    !d.ownerId && 'responsable',
                  ].filter(Boolean);
                  return (
                    <button
                      key={d.id}
                      onClick={() => irA(d.id)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="truncate text-xs text-orange-500">Falta: {falta.join(', ')}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{d.stage?.name}</span>
                    </button>
                  );
                })}
                {faltaInfo.length > 8 && (
                  <p className="pt-2 text-xs text-muted-foreground">y {faltaInfo.length - 8} más</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enfriandose */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-sky-500" />
              Se están enfriando
              {enfriandose.length > 0 && <Badge variant="secondary">{enfriandose.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enfriandose.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Ninguno abandonado. Bien ahí.</p>
            ) : (
              <div className="space-y-1">
                {enfriandose.slice(0, 8).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => irA(d.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.stage?.name}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-sky-500">
                      {dias(d.lastInteractionAt)}d sin contacto
                    </span>
                  </button>
                ))}
                {enfriandose.length > 8 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    y {enfriandose.length - 8} más sin seguimiento programado
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
