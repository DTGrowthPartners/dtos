import { useState, useEffect } from 'react';
import {
  Target,
  TrendingUp,
  Calendar,
  RefreshCw,
  ChevronDown,
  Users,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Archive,
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

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
}

interface AvailableMonth {
  month: number;
  year: number;
  name: string;
  isArchived: boolean;
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
      const data = await apiClient.get<ClientGoalsMetrics>(
        `/api/finance/client-goals?month=${month}&year=${year}`
      );
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching client goals metrics:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las métricas de meta de clientes',
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
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
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

      {/* Main Monthly Metric */}
      <div className="rounded-lg bg-card border border-border p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Nuevos Clientes - {monthDisplay}
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
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ejecutado</span>
              <span className="font-semibold text-foreground">
                {formatFullCurrency(metrics.executed.total)} / {formatFullCurrency(metrics.budget.total)}
              </span>
            </div>
            <Progress
              value={metrics.completion.percentage}
              className={cn(
                "h-3",
                metrics.completion.isAchieved ? "[&>div]:bg-success" : "[&>div]:bg-primary"
              )}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={cn(
                "font-medium",
                metrics.completion.isAchieved ? "text-success" : "text-primary"
              )}>
                {metrics.completion.percentage}% cumplido
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

      {/* Weekly Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Recurring Clients */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Recurrentes</h4>
              <p className="text-xs text-muted-foreground">Meta semanal</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meta</span>
              <span className="font-medium">{formatCurrency(metrics.weekly.recurringTarget)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Esta semana</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.weekly.recurringExecuted)}
              </span>
            </div>
            <Progress
              value={metrics.weekly.recurringPercentage}
              className="h-2 [&>div]:bg-blue-500"
            />
            <p className="text-xs text-right text-muted-foreground">
              {metrics.weekly.recurringPercentage}% de la meta semanal
            </p>
          </div>
        </div>

        {/* Project Clients */}
        <div className="rounded-lg bg-card border border-border p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Briefcase className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Proyectos</h4>
              <p className="text-xs text-muted-foreground">Meta semanal</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meta</span>
              <span className="font-medium">{formatCurrency(metrics.weekly.projectsTarget)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Esta semana</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(metrics.weekly.projectsExecuted)}
              </span>
            </div>
            <Progress
              value={metrics.weekly.projectsPercentage}
              className="h-2 [&>div]:bg-amber-500"
            />
            <p className="text-xs text-right text-muted-foreground">
              {metrics.weekly.projectsPercentage}% de la meta semanal
            </p>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Datos del presupuesto Q1 2026 desde Google Sheets
        </p>
      </div>
    </div>
  );
}
