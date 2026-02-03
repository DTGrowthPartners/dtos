import { useState, useEffect } from 'react';
import {
  Target,
  Search,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
  Play,
  Pause,
  Eye,
  Building2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'paused';
  platform: 'meta';
  objective: string;
  budget: number;
  spent: number;
  budgetRemaining: number;
  results: number;
  cpa: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  impressions: number;
  reach: number;
}

interface Account {
  id: string;
  name: string;
  businessName: string;
  businessId: string;
  campaignCount: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
}

interface DashboardTotals {
  totalAccounts: number;
  totalBusinesses: number;
  totalCampaigns: number;
  totalActiveCampaigns: number;
  totalPausedCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
}

interface DashboardResponse {
  success: boolean;
  totals: DashboardTotals;
  accounts: Account[];
  campaigns: Campaign[];
  datePreset: string;
  timestamp: string;
}

const statusConfig = {
  active: { label: 'Activa', className: 'bg-success/10 text-success border-success/20' },
  paused: { label: 'Pausada', className: 'bg-warning/10 text-warning border-warning/20' },
};

const objectiveLabels: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Tráfico',
  OUTCOME_ENGAGEMENT: 'Interacción',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Ventas',
  OUTCOME_APP_PROMOTION: 'Promoción App',
  OUTCOME_AWARENESS: 'Reconocimiento',
  BRAND_AWARENESS: 'Reconocimiento',
  REACH: 'Alcance',
  LINK_CLICKS: 'Clics en enlace',
  POST_ENGAGEMENT: 'Interacción',
  VIDEO_VIEWS: 'Vistas de video',
  LEAD_GENERATION: 'Generación de leads',
  MESSAGES: 'Mensajes',
  CONVERSIONS: 'Conversiones',
};

const datePresetOptions = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last_7d', label: 'Últimos 7 días' },
  { value: 'last_14d', label: 'Últimos 14 días' },
  { value: 'last_30d', label: 'Últimos 30 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes pasado' },
  { value: 'maximum', label: 'Todo el tiempo' },
];

export default function Campanas() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('last_30d');
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<DashboardResponse>(
        `/api/campaigns/dashboard?date_preset=${datePreset}`
      );

      if (data.success) {
        setCampaigns(data.campaigns || []);
        setAccounts(data.accounts || []);
        setTotals(data.totals);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las campañas de Meta Ads',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [datePreset]);

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'PAUSED' : 'ACTIVE';
    setTogglingCampaign(campaignId);

    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/api/campaigns/${campaignId}/status`,
        { status: newStatus }
      );

      if (response.success) {
        toast({
          title: 'Estado actualizado',
          description: `Campaña ${newStatus === 'ACTIVE' ? 'activada' : 'pausada'} correctamente`,
        });
        // Refresh data
        fetchDashboard();
      }
    } catch (error) {
      console.error('Error toggling campaign:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado de la campaña',
        variant: 'destructive',
      });
    } finally {
      setTogglingCampaign(null);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesAccount = accountFilter === 'all' || campaign.client === accountFilter;
    return matchesSearch && matchesStatus && matchesAccount;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Cargando campañas de Meta Ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campañas Meta Ads</h1>
          <p className="text-muted-foreground">
            Gestiona y monitorea el rendimiento de las campañas de tus clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {datePresetOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchDashboard} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inversión Total</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(totals?.totalSpend || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Campañas Activas</p>
              <p className="text-xl font-bold text-foreground">
                {totals?.totalActiveCampaigns || 0}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  / {totals?.totalCampaigns || 0}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
              <Eye className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impresiones</p>
              <p className="text-xl font-bold text-foreground">
                {formatNumber(totals?.totalImpressions || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
              <Users className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alcance</p>
              <p className="text-xl font-bold text-foreground">
                {formatNumber(totals?.totalReach || 0)}
              </p>
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
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.name}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {['all', 'active', 'paused'].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={cn(statusFilter !== status && 'bg-card')}
            >
              {status === 'all'
                ? 'Todas'
                : statusConfig[status as keyof typeof statusConfig]?.label || status}
            </Button>
          ))}
        </div>
      </div>

      {/* Campaign Cards */}
      {filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No se encontraron campañas</h3>
          <p className="text-muted-foreground">
            {campaigns.length === 0
              ? 'No hay campañas activas en Meta Ads'
              : 'Intenta ajustar los filtros de búsqueda'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onToggleStatus={toggleCampaignStatus}
              isToggling={togglingCampaign === campaign.id}
              formatCurrency={formatCurrency}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onToggleStatus,
  isToggling,
  formatCurrency,
  formatNumber,
}: {
  campaign: Campaign;
  onToggleStatus: (id: string, status: string) => void;
  isToggling: boolean;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
}) {
  const status = statusConfig[campaign.status];
  const progress = campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;
  const objectiveLabel = objectiveLabels[campaign.objective] || campaign.objective;

  return (
    <div className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="bg-blue-500/10 text-blue-600 text-xs">Meta</Badge>
            <Badge variant="outline" className={cn('text-xs', status.className)}>
              {status.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {objectiveLabel}
            </Badge>
          </div>
          <h3 className="font-semibold text-foreground truncate" title={campaign.name}>
            {campaign.name}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{campaign.client}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleStatus(campaign.id, campaign.status)}
          disabled={isToggling}
          className={cn(
            'flex-shrink-0',
            campaign.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success'
          )}
        >
          {isToggling ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : campaign.status === 'active' ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Inversión</p>
          <p className="font-semibold text-foreground">{formatCurrency(campaign.spent)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Resultados</p>
          <p className="font-semibold text-foreground">{formatNumber(campaign.results)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">CPA</p>
          <p className="font-semibold text-foreground">{formatCurrency(campaign.cpa)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
        <div>
          <p className="text-muted-foreground">Impresiones</p>
          <p className="font-medium text-foreground">{formatNumber(campaign.impressions)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Alcance</p>
          <p className="font-medium text-foreground">{formatNumber(campaign.reach)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">CTR</p>
          <p className="font-medium text-foreground">{campaign.ctr.toFixed(2)}%</p>
        </div>
      </div>

      {campaign.budget > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Presupuesto consumido</span>
            <span className="font-medium text-foreground">{Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <Progress
            value={Math.min(progress, 100)}
            className={cn(
              'h-2',
              progress > 90
                ? '[&>div]:bg-destructive'
                : progress > 70
                ? '[&>div]:bg-warning'
                : '[&>div]:bg-primary'
            )}
          />
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1">
          <TrendingUp
            className={cn('h-4 w-4', campaign.roas >= 2 ? 'text-success' : 'text-muted-foreground')}
          />
          <span className={cn('font-semibold', campaign.roas >= 2 ? 'text-success' : 'text-foreground')}>
            {campaign.roas.toFixed(1)}x ROAS
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          CPC: {formatCurrency(campaign.cpc)}
        </div>
      </div>
    </div>
  );
}
