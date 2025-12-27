import { Target, TrendingUp, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { campaigns } from '@/data/mockData';
import { cn } from '@/lib/utils';

const statusConfig = {
  active: { label: 'Activa', className: 'bg-success/10 text-success border-success/20' },
  paused: { label: 'Pausada', className: 'bg-warning/10 text-warning border-warning/20' },
  review: { label: 'En Revisión', className: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Completada', className: 'bg-muted text-muted-foreground border-muted' },
};

export function CampaignOverview() {
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').slice(0, 4);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const avgRoas = campaigns.filter((c) => c.roas > 0).reduce((acc, c, _, arr) => acc + c.roas / arr.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Campañas Activas</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>€{totalSpent.toLocaleString()} gastado</span>
          </div>
          <div className="flex items-center gap-1 text-success">
            <TrendingUp className="h-4 w-4" />
            <span>{avgRoas.toFixed(1)}x ROAS</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {activeCampaigns.map((campaign) => {
          const status = statusConfig[campaign.status];
          const progress = (campaign.spent / campaign.budget) * 100;

          return (
            <div key={campaign.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{campaign.name}</span>
                </div>
                <Badge variant="outline" className={cn('text-xs', status.className)}>
                  {status.label}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">{campaign.client}</p>
              
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Inversión: </span>
                  <span className="font-medium text-foreground">€{campaign.spent.toLocaleString()}</span>
                  <span className="text-muted-foreground"> / €{campaign.budget.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CPA: </span>
                  <span className="font-medium text-foreground">€{campaign.cpa.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ROAS: </span>
                  <span className={cn('font-medium', campaign.roas >= 3 ? 'text-success' : 'text-foreground')}>
                    {campaign.roas.toFixed(1)}x
                  </span>
                </div>
              </div>
              
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    progress > 90 ? 'bg-destructive' : progress > 70 ? 'bg-warning' : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full mt-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
        Ver todas las campañas →
      </button>
    </div>
  );
}
