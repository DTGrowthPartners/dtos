import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Presupuesto Q1 2025 - Hardcoded from Google Sheets "Presupuesto Q1"
const BUDGET_Q1 = {
  enero: {
    'Arriendo oficina': 1200000,
    'Nómina (Stiven)': 2000000,
    'Nómina (Edgardo)': 700000,
    'Nómina (Dairo)': 5000000,
    'Almuerzos': 1020000,
    'Transportes - Gasolina': 80000,
    'Servidores/Hosting/Dominios': 250000,
    'Herramientas (Claude, GPT, Lovable, Twilio, Etc)': 850000,
    'Honorarios Contador': 300000,
  },
  febrero: {
    'Arriendo oficina': 1200000,
    'Nómina (Stiven)': 2700000,
    'Nómina (Edgardo)': 700000,
    'Nómina (Dairo)': 5000000,
    'Almuerzos': 1020000,
    'Transportes - Gasolina': 80000,
    'Servidores/Hosting/Dominios': 250000,
    'Herramientas (Claude, GPT, Lovable, Twilio, Etc)': 500000,
    'Honorarios Contador': 300000,
  },
  marzo: {
    'Arriendo oficina': 1200000,
    'Nómina (Stiven)': 2700000,
    'Nómina (Edgardo)': 700000,
    'Nómina (Dairo)': 5000000,
    'Almuerzos': 1020000,
    'Transportes - Gasolina': 80000,
    'Servidores/Hosting/Dominios': 250000,
    'Herramientas (Claude, GPT, Lovable, Twilio, Etc)': 500000,
    'Honorarios Contador': 300000,
  },
};

// Total por mes
const BUDGET_TOTALS = {
  enero: 11400000,
  febrero: 11750000,
  marzo: 11750000,
};

interface Transaction {
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
}

interface BudgetComparisonReportProps {
  gastos: Transaction[];
}

// Map categories from transactions to budget categories
const categoryMapping: Record<string, string> = {
  'Arriendo': 'Arriendo oficina',
  'Nómina (Dairo)': 'Nómina (Dairo)',
  'Nómina (Edgardo)': 'Nómina (Edgardo)',
  'Nómina (Stiven)': 'Nómina (Stiven)',
  'Almuerzos': 'Almuerzos',
  'Transportes - Gasolina': 'Transportes - Gasolina',
  'Servidores/Hosting/Dominios': 'Servidores/Hosting/Dominios',
  'Herramientas (Claude, GPT, Lovable, Twilio, Etc)': 'Herramientas (Claude, GPT, Lovable, Twilio, Etc)',
  'Honorarios Contador': 'Honorarios Contador',
};

export default function BudgetComparisonReport({ gastos }: BudgetComparisonReportProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get current month
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const currentMonthKey = currentMonth === 'enero' ? 'enero' : currentMonth === 'febrero' ? 'febrero' : currentMonth === 'marzo' ? 'marzo' : 'enero';

  // Normalize date helper
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, part1, part2, year] = slashMatch;
      const num1 = parseInt(part1);
      const num2 = parseInt(part2);
      if (num1 > 12) return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
      else if (num2 > 12) return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
      else return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
    }

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    } catch {
      console.warn('Could not parse date:', dateStr);
    }
    return dateStr;
  };

  // Filter gastos for current month
  const currentMonthGastos = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const yearMonthPrefix = `${year}-${monthStr}`;

    return gastos.filter(g => {
      const normalized = normalizeDate(g.fecha);
      return normalized.startsWith(yearMonthPrefix);
    });
  }, [gastos, currentDate]);

  // Calculate actual spending by budget category
  const actualSpendingByCategory = useMemo(() => {
    const spending: Record<string, number> = {};

    // Initialize with budget categories
    const budgetCategories = Object.keys(BUDGET_Q1[currentMonthKey as keyof typeof BUDGET_Q1] || BUDGET_Q1.enero);
    budgetCategories.forEach(cat => {
      spending[cat] = 0;
    });

    // Sum up actual spending
    currentMonthGastos.forEach(g => {
      const budgetCategory = categoryMapping[g.categoria] || g.categoria;
      if (spending[budgetCategory] !== undefined) {
        spending[budgetCategory] += g.importe;
      } else {
        // Try partial match
        const matchedKey = Object.keys(spending).find(key =>
          g.categoria.toLowerCase().includes(key.toLowerCase()) ||
          key.toLowerCase().includes(g.categoria.toLowerCase())
        );
        if (matchedKey) {
          spending[matchedKey] += g.importe;
        }
      }
    });

    return spending;
  }, [currentMonthGastos, currentMonthKey]);

  // Prepare comparison data for chart
  const comparisonData = useMemo(() => {
    const budget = BUDGET_Q1[currentMonthKey as keyof typeof BUDGET_Q1] || BUDGET_Q1.enero;

    return Object.entries(budget).map(([category, budgeted]) => {
      const actual = actualSpendingByCategory[category] || 0;
      const difference = budgeted - actual;
      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0;

      return {
        category: category.length > 20 ? category.substring(0, 20) + '...' : category,
        fullCategory: category,
        presupuesto: budgeted,
        real: actual,
        diferencia: difference,
        percentUsed,
        status: percentUsed > 100 ? 'over' : percentUsed > 80 ? 'warning' : 'ok',
      };
    }).sort((a, b) => b.presupuesto - a.presupuesto);
  }, [currentMonthKey, actualSpendingByCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    const budgetTotal = BUDGET_TOTALS[currentMonthKey as keyof typeof BUDGET_TOTALS] || BUDGET_TOTALS.enero;
    const actualTotal = Object.values(actualSpendingByCategory).reduce((sum, val) => sum + val, 0);
    const difference = budgetTotal - actualTotal;
    const percentUsed = budgetTotal > 0 ? (actualTotal / budgetTotal) * 100 : 0;

    return {
      budgetTotal,
      actualTotal,
      difference,
      percentUsed,
    };
  }, [currentMonthKey, actualSpendingByCategory]);

  // Monthly comparison data
  const monthlyComparison = useMemo(() => {
    const months = ['enero', 'febrero', 'marzo'];
    const monthNames = ['Ene', 'Feb', 'Mar'];

    return months.map((month, idx) => {
      const budget = BUDGET_TOTALS[month as keyof typeof BUDGET_TOTALS];

      // Calculate actual for this month
      const year = currentDate.getFullYear();
      const monthNum = idx + 1;
      const monthStr = String(monthNum).padStart(2, '0');
      const yearMonthPrefix = `${year}-${monthStr}`;

      const monthGastos = gastos.filter(g => {
        const normalized = normalizeDate(g.fecha);
        return normalized.startsWith(yearMonthPrefix);
      });

      const actual = monthGastos.reduce((sum, g) => sum + g.importe, 0);

      return {
        month: monthNames[idx],
        presupuesto: budget,
        real: actual,
        diferencia: budget - actual,
      };
    });
  }, [gastos, currentDate]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}k`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Presupuesto vs Real - Q1 2025</h2>
          <p className="text-sm text-muted-foreground">
            Comparación de gastos operativos del mes de {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Presupuesto {currentMonth}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.budgetTotal)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gasto Real</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.actualTotal)}</p>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          totals.difference >= 0
            ? "border-success/50 bg-success/10"
            : "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">Diferencia</p>
          <div className="flex items-center gap-2 mt-1">
            {totals.difference >= 0 ? (
              <TrendingDown className="h-5 w-5 text-success" />
            ) : (
              <TrendingUp className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              totals.difference >= 0 ? "text-success" : "text-destructive"
            )}>
              {totals.difference >= 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.difference))}
            </p>
          </div>
        </div>

        <div className={cn(
          "rounded-xl border p-4",
          totals.percentUsed <= 80 ? "border-success/50 bg-success/10" :
          totals.percentUsed <= 100 ? "border-warning/50 bg-warning/10" :
          "border-destructive/50 bg-destructive/10"
        )}>
          <p className="text-sm text-muted-foreground">% Ejecutado</p>
          <div className="flex items-center gap-2 mt-1">
            {totals.percentUsed <= 80 ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : totals.percentUsed <= 100 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <p className={cn(
              "text-2xl font-bold",
              totals.percentUsed <= 80 ? "text-success" :
              totals.percentUsed <= 100 ? "text-warning" :
              "text-destructive"
            )}>
              {totals.percentUsed.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Comparison Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Comparación Mensual Q1</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
              />
              <Legend />
              <Bar dataKey="presupuesto" name="Presupuesto" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="real" name="Real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Desglose por Categoría - {currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === 'presupuesto' ? 'Presupuesto' : 'Real']}
                labelFormatter={(label) => comparisonData.find(d => d.category === label)?.fullCategory || label}
              />
              <Legend />
              <Bar dataKey="presupuesto" name="Presupuesto" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="real" name="Real" radius={[0, 4, 4, 0]}>
                {comparisonData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.status === 'over' ? 'hsl(var(--destructive))' :
                      entry.status === 'warning' ? 'hsl(var(--warning))' :
                      'hsl(var(--success))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Detalle de Ejecución</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Categoría</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Presupuesto</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Real</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Diferencia</th>
                <th className="text-right py-3 px-2 font-medium text-muted-foreground">% Usado</th>
                <th className="text-center py-3 px-2 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-2 text-foreground" title={row.fullCategory}>{row.category}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">${row.presupuesto.toLocaleString()}</td>
                  <td className="py-3 px-2 text-right text-foreground font-medium">${row.real.toLocaleString()}</td>
                  <td className={cn(
                    "py-3 px-2 text-right font-medium",
                    row.diferencia >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {row.diferencia >= 0 ? '-' : '+'}${Math.abs(row.diferencia).toLocaleString()}
                  </td>
                  <td className={cn(
                    "py-3 px-2 text-right font-medium",
                    row.percentUsed <= 80 ? "text-success" :
                    row.percentUsed <= 100 ? "text-warning" :
                    "text-destructive"
                  )}>
                    {row.percentUsed.toFixed(1)}%
                  </td>
                  <td className="py-3 px-2 text-center">
                    {row.status === 'ok' && <CheckCircle className="h-4 w-4 text-success inline" />}
                    {row.status === 'warning' && <AlertTriangle className="h-4 w-4 text-warning inline" />}
                    {row.status === 'over' && <AlertTriangle className="h-4 w-4 text-destructive inline" />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="py-3 px-2 text-foreground">TOTAL</td>
                <td className="py-3 px-2 text-right text-muted-foreground">${totals.budgetTotal.toLocaleString()}</td>
                <td className="py-3 px-2 text-right text-foreground">${totals.actualTotal.toLocaleString()}</td>
                <td className={cn(
                  "py-3 px-2 text-right",
                  totals.difference >= 0 ? "text-success" : "text-destructive"
                )}>
                  {totals.difference >= 0 ? '-' : '+'}${Math.abs(totals.difference).toLocaleString()}
                </td>
                <td className={cn(
                  "py-3 px-2 text-right",
                  totals.percentUsed <= 80 ? "text-success" :
                  totals.percentUsed <= 100 ? "text-warning" :
                  "text-destructive"
                )}>
                  {totals.percentUsed.toFixed(1)}%
                </td>
                <td className="py-3 px-2 text-center">
                  {totals.percentUsed <= 80 && <CheckCircle className="h-5 w-5 text-success inline" />}
                  {totals.percentUsed > 80 && totals.percentUsed <= 100 && <AlertTriangle className="h-5 w-5 text-warning inline" />}
                  {totals.percentUsed > 100 && <AlertTriangle className="h-5 w-5 text-destructive inline" />}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Leyenda</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">Bajo control (&le;80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-muted-foreground">Atención (80-100%)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-muted-foreground">Excedido (&gt;100%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
