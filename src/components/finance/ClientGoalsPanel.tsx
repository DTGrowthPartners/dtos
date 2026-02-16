import { useState, useEffect } from 'react';
import {
  Target,
  TrendingUp,
  RefreshCw,
  Users,
  Briefcase,
  CheckCircle2,
  Archive,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface WeeklyDetail {
  weekNumber: number;
  target: number;
  executed: number;
  percentage: number;
}

interface ClientGoalsMetrics {
  month: string;
  monthNumber: number;
  year: number;
  isArchived: boolean;
  budget: {
    total: number;
    recurring: number;
    projects: number;
  };
  executed: {
    total: number;
    recurring: number;
    projects: number;
  };
  completion: {
    percentage: number;
    remaining: number;
    isAchieved: boolean;
  };
  weekly: {
    currentWeek: number;
    totalWeeks: number;
    recurringTarget: number;
    projectsTarget: number;
    recurringExecuted: number;
    projectsExecuted: number;
    recurringPercentage: number;
    projectsPercentage: number;
  };
  weeklyRecurring: {
    monthlyTarget: number;
    weeklyTarget: number;
    weeks: WeeklyDetail[];
  };
  weeklyProjects: {
    monthlyTarget: number;
    weeklyTarget: number;
    weeks: WeeklyDetail[];
  };
}

interface AvailableMonth {
  month: number;
  year: number;
  name: string;
  isArchived: boolean;
}

interface ClientGoalRow {
  cliente: string;
  meta: number;
  ingresoReal: number;
  porcentaje: number;
  semaforo: 'verde' | 'amarillo' | 'rojo';
}

interface ClientGoalsByClient {
  month: number;
  year: number;
  monthName: string;
  clients: ClientGoalRow[];
  totals: {
    meta: number;
    ingresoReal: number;
    porcentaje: number;
    semaforo: 'verde' | 'amarillo' | 'rojo';
  };
}

// Helper to format currency in Colombian pesos
const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
};

// Helper to format full currency
const formatFullCurrency = (value: number): string => {
  return `$${Math.round(value).toLocaleString()}`;
};

export default function ClientGoalsPanel() {
  const [metrics, setMetrics] = useState<ClientGoalsMetrics | null>(null);
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [recurringOpen, setRecurringOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [clientGoalsOpen, setClientGoalsOpen] = useState(true);
  const [clientGoals, setClientGoals] = useState<ClientGoalsByClient | null>(null);
  const [isLoadingClientGoals, setIsLoadingClientGoals] = useState(false);
  const { toast } = useToast();

  // Load available months on mount
  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  // Load metrics when selected month changes
  useEffect(() => {
    if (selectedMonth) {
      const [month, year] = selectedMonth.split('-').map(Number);
      fetchMetrics(month, year);
    }
  }, [selectedMonth]);

  const fetchAvailableMonths = async () => {
    try {
      const data = await apiClient.get<AvailableMonth[]>('/api/finance/client-goals/months');
      setAvailableMonths(data);

      // Select the current (non-archived) month by default, or the first one
      const currentMonth = data.find(m => !m.isArchived) || data[0];
      if (currentMonth) {
        setSelectedMonth(`${currentMonth.month}-${currentMonth.year}`);
      }
    } catch (error) {
      console.error('Error fetching available months:', error);
      // Fallback to current month
      const now = new Date();
      setSelectedMonth(`${now.getMonth() + 1}-${now.getFullYear()}`);
    }
  };

  const fetchMetrics = async (month: number, year: number) => {
    try {
      setIsLoading(true);
      const [metricsData, clientGoalsData] = await Promise.all([
        apiClient.get<ClientGoalsMetrics>(
          `/api/finance/client-goals?month=${month}&year=${year}`
        ),
        apiClient.get<ClientGoalsByClient>(
          `/api/finance/client-goals/by-client?month=${month}&year=${year}`
        ),
      ]);
      setMetrics(metricsData);
      setClientGoals(clientGoalsData);
    } catch (error) {
      console.error('Error fetching client goals metrics:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las metricas de meta de clientes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedMonth) {
      const [month, year] = selectedMonth.split('-').map(Number);
      fetchMetrics(month, year);
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-8 w-32 bg-muted rounded" />
        </div>
        <div className="h-24 bg-muted rounded mb-4" />
        <div className="grid grid-cols-1 gap-4">
          <div className="h-48 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const monthDisplay = `${metrics.month.charAt(0).toUpperCase() + metrics.month.slice(1)} ${metrics.year}`;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-success/5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Meta de Clientes
              </h3>
              {metrics.isArchived && (
                <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  <Archive className="h-3 w-3" />
                  Archivado
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Presupuesto: {formatFullCurrency(metrics.budget.total)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Seleccionar mes" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
                  <div className="flex items-center gap-2">
                    {m.isArchived && <Archive className="h-3 w-3 text-muted-foreground" />}
                    <span>{m.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 1. Indicador del Mes - Principal */}
      <div className="rounded-lg bg-card border border-border p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Indicador del Mes - {monthDisplay}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {metrics.completion.isAchieved ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Meta Alcanzada
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Semana {metrics.weekly.currentWeek} de {metrics.weekly.totalWeeks}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {/* Valor Proyectado */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Valor Proyectado:</span>
            <span className="font-semibold text-foreground">
              META {formatCurrency(metrics.budget.total)} (Clientes recurrentes y proyectos)
            </span>
          </div>

          {/* Valor Clientes desglosado */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Valor Clientes:</span>
            <span className="font-semibold text-foreground">
              <span className="text-blue-600">Recurrentes {formatCurrency(metrics.executed.recurring)}</span>
              {' + '}
              <span className="text-amber-600">Proyectos {formatCurrency(metrics.executed.projects)}</span>
              {' = '}
              <span className="text-primary">{formatCurrency(metrics.executed.total)}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <Progress
              value={metrics.completion.percentage}
              className={cn(
                "h-4",
                metrics.completion.isAchieved ? "[&>div]:bg-success" : "[&>div]:bg-primary"
              )}
            />
            <div className="flex items-center justify-between text-sm">
              <span className={cn(
                "font-bold text-lg",
                metrics.completion.isAchieved ? "text-success" : "text-primary"
              )}>
                Meta Alcanzada: {metrics.completion.percentage}%
              </span>
              {!metrics.completion.isAchieved && (
                <span className="text-muted-foreground">
                  Faltan: {formatCurrency(metrics.completion.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Indicador Semanal - Clientes Recurrentes */}
      <Collapsible open={recurringOpen} onOpenChange={setRecurringOpen} className="mb-4">
        <div className="rounded-lg bg-card border border-blue-200 overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-foreground">
                    Indicador Semanal - Clientes Recurrentes
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Valor Proyectado MES: {formatCurrency(metrics.weeklyRecurring.monthlyTarget)}/mes
                  </p>
                </div>
              </div>
              {recurringOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {metrics.weeklyRecurring.weeks.map((week) => {
                const isCurrentWeek = week.weekNumber === metrics.weekly.currentWeek && !metrics.isArchived;
                const isFutureWeek = week.weekNumber > metrics.weekly.currentWeek && !metrics.isArchived;

                return (
                  <div
                    key={`recurring-${week.weekNumber}`}
                    className={cn(
                      "rounded-lg border p-3",
                      isCurrentWeek ? "border-blue-400 bg-blue-50/50" : "border-border",
                      isFutureWeek && "opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-medium",
                        isCurrentWeek && "text-blue-600"
                      )}>
                        Semana {week.weekNumber}
                        {isCurrentWeek && " (Actual)"}
                      </span>
                      <span className={cn(
                        "text-lg font-bold",
                        week.percentage >= 100 ? "text-success" :
                        week.percentage >= 80 ? "text-blue-600" :
                        week.percentage >= 50 ? "text-amber-600" : "text-red-500"
                      )}>
                        {week.percentage}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Proyectado/semana:</span>
                        <span className="font-medium ml-1">{formatCurrency(week.target)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ejecutado:</span>
                        <span className="font-semibold ml-1 text-blue-600">{formatCurrency(week.executed)}</span>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, week.percentage)}
                      className="h-2 [&>div]:bg-blue-500"
                    />
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* 3. Indicador Semanal - Clientes Proyectos */}
      <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
        <div className="rounded-lg bg-card border border-amber-200 overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 hover:bg-amber-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Briefcase className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-foreground">
                    Indicador Semanal - Clientes Proyectos
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Valor Proyectado MES: {formatCurrency(metrics.weeklyProjects.monthlyTarget)}/mes
                  </p>
                </div>
              </div>
              {projectsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {metrics.weeklyProjects.weeks.map((week) => {
                const isCurrentWeek = week.weekNumber === metrics.weekly.currentWeek && !metrics.isArchived;
                const isFutureWeek = week.weekNumber > metrics.weekly.currentWeek && !metrics.isArchived;

                return (
                  <div
                    key={`projects-${week.weekNumber}`}
                    className={cn(
                      "rounded-lg border p-3",
                      isCurrentWeek ? "border-amber-400 bg-amber-50/50" : "border-border",
                      isFutureWeek && "opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-sm font-medium",
                        isCurrentWeek && "text-amber-600"
                      )}>
                        Semana {week.weekNumber}
                        {isCurrentWeek && " (Actual)"}
                      </span>
                      <span className={cn(
                        "text-lg font-bold",
                        week.percentage >= 100 ? "text-success" :
                        week.percentage >= 80 ? "text-amber-600" :
                        week.percentage >= 50 ? "text-yellow-600" : "text-red-500"
                      )}>
                        {week.percentage}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Proyectado/semana:</span>
                        <span className="font-medium ml-1">{formatCurrency(week.target)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ejecutado:</span>
                        <span className="font-semibold ml-1 text-amber-600">{formatCurrency(week.executed)}</span>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, week.percentage)}
                      className="h-2 [&>div]:bg-amber-500"
                    />
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* 4. Metas por Cliente/Proyecto */}
      {clientGoals && clientGoals.clients.length > 0 && (
        <Collapsible open={clientGoalsOpen} onOpenChange={setClientGoalsOpen} className="mt-4">
          <div className="rounded-lg bg-card border border-emerald-200 overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Target className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-foreground">
                      Metas por Cliente / Proyecto
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {clientGoals.clients.length} clientes con meta -{' '}
                      {clientGoals.monthName.charAt(0).toUpperCase() + clientGoals.monthName.slice(1)} {clientGoals.year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {clientGoals.totals.semaforo === 'verde' ? '🟢' :
                     clientGoals.totals.semaforo === 'amarillo' ? '🟡' : '🔴'}
                  </span>
                  <span className={cn(
                    "text-lg font-bold",
                    clientGoals.totals.porcentaje >= 80 ? "text-emerald-600" :
                    clientGoals.totals.porcentaje >= 50 ? "text-amber-600" : "text-red-500"
                  )}>
                    {clientGoals.totals.porcentaje}%
                  </span>
                  {clientGoalsOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                {/* Summary row */}
                <div className="rounded-lg bg-emerald-50/50 border border-emerald-200 p-3 mb-3">
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Meta Total</span>
                      <p className="font-bold text-foreground">{formatFullCurrency(clientGoals.totals.meta)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Ingreso Real</span>
                      <p className="font-bold text-emerald-600">{formatFullCurrency(clientGoals.totals.ingresoReal)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Cumplimiento</span>
                      <p className={cn(
                        "font-bold",
                        clientGoals.totals.porcentaje >= 80 ? "text-emerald-600" :
                        clientGoals.totals.porcentaje >= 50 ? "text-amber-600" : "text-red-500"
                      )}>{clientGoals.totals.porcentaje}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Faltante</span>
                      <p className="font-bold text-foreground">
                        {formatFullCurrency(Math.max(0, clientGoals.totals.meta - clientGoals.totals.ingresoReal))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Per-client table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs"></th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">Cliente / Proyecto</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Meta</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">Ingreso Real</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientGoals.clients.map((client, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-2 px-2 text-center text-lg">
                            {client.semaforo === 'verde' ? '🟢' :
                             client.semaforo === 'amarillo' ? '🟡' : '🔴'}
                          </td>
                          <td className="py-2 px-2 text-foreground font-medium">{client.cliente}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{formatCurrency(client.meta)}</td>
                          <td className={cn(
                            "py-2 px-2 text-right font-medium",
                            client.ingresoReal > 0 ? "text-emerald-600" : "text-muted-foreground"
                          )}>
                            {formatCurrency(client.ingresoReal)}
                          </td>
                          <td className={cn(
                            "py-2 px-2 text-right font-bold",
                            client.porcentaje >= 80 ? "text-emerald-600" :
                            client.porcentaje >= 50 ? "text-amber-600" : "text-red-500"
                          )}>
                            {client.porcentaje}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Footer info */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Datos del presupuesto Q1 2026 desde Google Sheets - Ejecutado desde CRM (Deals Ganados)
        </p>
      </div>
    </div>
  );
}
