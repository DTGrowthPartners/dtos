import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1 sm:mt-2 text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>}
          {trend && (
            <div className={cn('mt-1 sm:mt-2 flex items-center gap-1 text-xs sm:text-sm font-medium', trend.isPositive ? 'text-success' : 'text-destructive')}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground font-normal hidden sm:inline">vs mes anterior</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 sm:h-10 sm:w-10 lg:h-12 lg:w-12 items-center justify-center rounded-lg sm:rounded-xl transition-transform group-hover:scale-110 flex-shrink-0',
            variant === 'default' && 'bg-muted text-muted-foreground',
            variant === 'primary' && 'bg-primary/10 text-primary',
            variant === 'success' && 'bg-success/10 text-success',
            variant === 'warning' && 'bg-warning/10 text-warning'
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        </div>
      </div>
    </div>
  );
}
