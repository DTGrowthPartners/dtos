import { useState } from 'react';
import { Target, Search, Filter, TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { campaigns, Campaign } from '@/data/mockData';
import { cn } from '@/lib/utils';

const statusConfig = {
  active: { label: 'Activa', className: 'bg-success/10 text-success border-success/20' },
  paused: { label: 'Pausada', className: 'bg-warning/10 text-warning border-warning/20' },
  review: { label: 'En Revisión', className: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Completada', className: 'bg-muted text-muted-foreground border-muted' },
};

const platformConfig = {
  meta: { label: 'Meta', className: 'bg-blue-500/10 text-blue-600' },
  google: { label: 'Google', className: 'bg-red-500/10 text-red-600' },
  tiktok: { label: 'TikTok', className: 'bg-pink-500/10 text-pink-600' },
};

export default function Campanas() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spent, 0);
  const totalResults = campaigns.reduce((acc, c) => acc + (c.roas > 0 ? c.results : 0), 0);
  const avgRoas = campaigns.filter((c) => c.roas > 0).reduce((acc, c, _, arr) => acc + c.roas / arr.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campañas Meta Ads</h1>
          <p className="text-muted-foreground">Gestiona y monitorea el rendimiento de tus campañas</p>
        </div>
        <Button className="w-full md:w-auto">
          <Target className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inversión Total</p>
              <p className="text-xl font-bold text-foreground">€{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversiones</p>
              <p className="text-xl font-bold text-foreground">{totalResults.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ROAS Promedio</p>
              <p className="text-xl font-bold text-foreground">{avgRoas.toFixed(1)}x</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <BarChart3 className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Presupuesto Restante</p>
              <p className="text-xl font-bold text-foreground">€{(totalBudget - totalSpent).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campañas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'paused', 'review'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={cn(statusFilter !== status && 'bg-card')}
            >
              {status === 'all' ? 'Todas' : statusConfig[status as keyof typeof statusConfig]?.label || status}
            </Button>
          ))}
        </div>
      </div>

      {/* Campaign Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>

      {/* Empty State */}
      {filteredCampaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No se encontraron campañas</h3>
          <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const status = statusConfig[campaign.status];
  const platform = platformConfig[campaign.platform];
  const progress = (campaign.spent / campaign.budget) * 100;

  return (
    <div className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-xs', platform.className)}>{platform.label}</Badge>
            <Badge variant="outline" className={cn('text-xs', status.className)}>
              {status.label}
            </Badge>
          </div>
          <h3 className="font-semibold text-foreground">{campaign.name}</h3>
          <p className="text-sm text-muted-foreground">{campaign.client}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Inversión</p>
          <p className="font-semibold text-foreground">€{campaign.spent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resultados</p>
          <p className="font-semibold text-foreground">{campaign.results.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CPA</p>
          <p className="font-semibold text-foreground">€{campaign.cpa.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Presupuesto consumido</span>
          <span className="font-medium text-foreground">{progress.toFixed(0)}%</span>
        </div>
        <Progress
          value={progress}
          className={cn(
            'h-2',
            progress > 90 ? '[&>div]:bg-destructive' : progress > 70 ? '[&>div]:bg-warning' : '[&>div]:bg-primary'
          )}
        />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1">
          <TrendingUp className={cn('h-4 w-4', campaign.roas >= 3 ? 'text-success' : 'text-muted-foreground')} />
          <span className={cn('font-semibold', campaign.roas >= 3 ? 'text-success' : 'text-foreground')}>
            {campaign.roas.toFixed(1)}x ROAS
          </span>
        </div>
        <Button variant="ghost" size="sm" className="text-primary">
          Ver Detalles
        </Button>
      </div>
    </div>
  );
}
