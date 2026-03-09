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
  Grid3X3,
  List,
  Table,
  X,
  Filter,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Globe,
  Plus,
  Megaphone,
  MousePointerClick,
  MonitorSmartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  disable_reason?: number;
  currency: string;
  amount_spent: string;
  statusLabel: string;
  hasAlert: boolean;
  disableReasonLabel: string | null;
  businessName: string;
  businessId: string | null;
}

interface Campaign {
  id: string;
  name: string;
  client: string;
  accountId: string;
  status: string;
  objective: string;
  budget: number;
  spent: number;
  results: number;
  cpa: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  clicks: number;
  impressions: number;
  reach: number;
  startTime?: string;
  stopTime?: string;
}

interface DashboardTotals {
  totalAccounts: number;
  totalCampaigns: number;
  totalActiveCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
}

interface DashboardAccount {
  id: string;
  name: string;
  businessName: string;
  accountStatus: number;
  statusLabel: string;
  currency: string;
  campaignCount: number;
  activeCampaigns: number;
  totalSpend: number;
  totalImpressions: number;
  totalReach: number;
}

// ─── Constants ───────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
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

const objectiveOptions = [
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', desc: 'Sitio web o perfil IG' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción', desc: 'Mensajes (WA, Messenger, IG DM)' },
  { value: 'OUTCOME_LEADS', label: 'Leads', desc: 'Generación de leads' },
  { value: 'OUTCOME_SALES', label: 'Ventas', desc: 'Ventas / conversiones' },
  { value: 'OUTCOME_AWARENESS', label: 'Reconocimiento', desc: 'Alcance / ThruPlay' },
];

const destinationOptions = [
  { value: 'WEBSITE', label: 'Sitio Web' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'MESSENGER', label: 'Messenger' },
  { value: 'INSTAGRAM_DIRECT', label: 'Instagram DM' },
];

// ─── Helpers ─────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

// ─── Main Component ──────────────────────────────────────

export default function Ads() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ads</h1>
        <p className="text-muted-foreground">Gestión directa de Meta Ads - Cuentas, campañas e insights</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Cuentas
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" />
            Crear Campaña
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="create">
          <CreateCampaignTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────

function DashboardTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [objectiveFilter, setObjectiveFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('last_30d');
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'list'>('cards');
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.get<any>(`/api/ads/dashboard?date_preset=${datePreset}`);
      if (data.success) {
        setCampaigns(data.campaigns || []);
        setAccounts(data.accounts || []);
        setTotals(data.totals);
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al cargar datos de Meta Ads';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, [datePreset]);

  const toggleStatus = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'PAUSED' : 'ACTIVE';
    setTogglingCampaign(campaignId);
    try {
      const res = await apiClient.post<any>(`/api/ads/campaigns/${campaignId}/status`, { status: newStatus });
      if (res.success) {
        toast({ title: 'Estado actualizado', description: res.message });
        fetchDashboard();
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cambiar el estado', variant: 'destructive' });
    } finally {
      setTogglingCampaign(null);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesAccount = accountFilter === 'all' || c.client === accountFilter;
    const matchesObjective = objectiveFilter === 'all' || c.objective === objectiveFilter;
    return matchesSearch && matchesStatus && matchesAccount && matchesObjective;
  });

  const uniqueObjectives = Array.from(new Set(campaigns.map(c => c.objective)));
  const uniqueClients = Array.from(new Set(campaigns.map(c => c.client)));
  const activeFiltersCount = [statusFilter !== 'all', accountFilter !== 'all', objectiveFilter !== 'all'].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Cargando datos de Meta Ads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-warning mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No se pudo conectar con Meta Ads</h3>
        <p className="text-muted-foreground mb-4 max-w-md">{error}</p>
        <p className="text-sm text-muted-foreground mb-4">
          Verifica que META_ACCESS_TOKEN esté configurado en las variables de entorno del backend.
        </p>
        <Button onClick={fetchDashboard}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {datePresetOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchDashboard}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredCampaigns.length} de {campaigns.length} campañas
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={DollarSign} iconColor="text-primary" bgColor="bg-primary/10" label="Inversión Total" value={formatCurrency(totals?.totalSpend || 0)} />
        <StatCard icon={Target} iconColor="text-success" bgColor="bg-success/10" label="Campañas Activas" value={`${totals?.totalActiveCampaigns || 0}`} sub={`/ ${totals?.totalCampaigns || 0}`} />
        <StatCard icon={Eye} iconColor="text-chart-1" bgColor="bg-chart-1/10" label="Impresiones" value={formatNumber(totals?.totalImpressions || 0)} />
        <StatCard icon={Users} iconColor="text-chart-4" bgColor="bg-chart-4/10" label="Alcance" value={formatNumber(totals?.totalReach || 0)} />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar campañas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(['cards', 'table', 'list'] as const).map(mode => (
              <Button key={mode} variant={viewMode === mode ? 'default' : 'outline'} size="icon" onClick={() => setViewMode(mode)}>
                {mode === 'cards' ? <Grid3X3 className="h-4 w-4" /> : mode === 'table' ? <Table className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {['all', 'active', 'paused'].map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Todas' : s === 'active' ? 'Activas' : 'Pausadas'}
            </Button>
          ))}
          <div className="h-6 w-px bg-border" />
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todas las cuentas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <Target className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos los objetivos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los objetivos</SelectItem>
              {uniqueObjectives.map(o => <SelectItem key={o} value={o}>{objectiveLabels[o] || o}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setAccountFilter('all'); setObjectiveFilter('all'); }}>
              <X className="h-4 w-4 mr-1" /> Limpiar ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Campaign list */}
      {filteredCampaigns.length === 0 ? (
        <EmptyState icon={Target} title="No se encontraron campañas" description={campaigns.length === 0 ? 'No hay campañas en Meta Ads' : 'Ajusta los filtros de búsqueda'} />
      ) : (
        <>
          {viewMode === 'cards' && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onToggle={toggleStatus} isToggling={togglingCampaign === c.id} />
              ))}
            </div>
          )}
          {viewMode === 'table' && (
            <CampaignTable campaigns={filteredCampaigns} onToggle={toggleStatus} togglingCampaign={togglingCampaign} />
          )}
          {viewMode === 'list' && (
            <CampaignListView campaigns={filteredCampaigns} onToggle={toggleStatus} togglingCampaign={togglingCampaign} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Accounts Tab ────────────────────────────────────────

function AccountsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.get<any>('/api/ads/ad-accounts');
      if (data.success) setAccounts(data.accounts || []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar cuentas');
      toast({ title: 'Error', description: 'No se pudieron cargar las cuentas de anuncios', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Cargando cuentas de anuncios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-warning mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error de conexión</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchAccounts}><RefreshCw className="h-4 w-4 mr-2" /> Reintentar</Button>
      </div>
    );
  }

  const activeAccounts = accounts.filter(a => a.account_status === 1);
  const alertAccounts = accounts.filter(a => a.hasAlert);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <CreditCard className="h-3 w-3" /> {accounts.length} cuentas
          </Badge>
          <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3" /> {activeAccounts.length} activas
          </Badge>
          {alertAccounts.length > 0 && (
            <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">
              <AlertTriangle className="h-3 w-3" /> {alertAccounts.length} con alertas
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchAccounts}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map(account => (
          <div
            key={account.id}
            className={cn(
              'rounded-xl border bg-card p-5 transition-shadow hover:shadow-md',
              account.hasAlert ? 'border-destructive/30' : 'border-border'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{account.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{account.businessName}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs ml-2 flex-shrink-0',
                  account.account_status === 1
                    ? 'bg-success/10 text-success border-success/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                )}
              >
                {account.statusLabel}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs text-foreground">{account.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Moneda</span>
                <span className="text-foreground">{account.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total gastado</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(parseFloat(account.amount_spent || '0') / 100)}
                </span>
              </div>
              {account.disableReasonLabel && account.disableReasonLabel !== 'Ninguno' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Razón deshabilitación</span>
                  <span className="text-destructive text-xs">{account.disableReasonLabel}</span>
                </div>
              )}
            </div>

            {account.hasAlert && (
              <div className="mt-3 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Esta cuenta requiere atención</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {accounts.length === 0 && (
        <EmptyState icon={CreditCard} title="Sin cuentas de anuncios" description="No se encontraron cuentas vinculadas al token de Meta." />
      )}
    </div>
  );
}

// ─── Create Campaign Tab ─────────────────────────────────

function CreateCampaignTab() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [selectedAccount, setSelectedAccount] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [destinationType, setDestinationType] = useState('');
  const [targetCountry, setTargetCountry] = useState('CO');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    apiClient.get<any>('/api/ads/ad-accounts')
      .then(data => {
        if (data.success) {
          setAccounts((data.accounts || []).filter((a: AdAccount) => a.account_status === 1));
        }
      })
      .catch(() => {
        toast({ title: 'Error', description: 'No se pudieron cargar las cuentas', variant: 'destructive' });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const getOptimizationGoal = () => {
    switch (objective) {
      case 'OUTCOME_TRAFFIC': return 'LANDING_PAGE_VIEWS';
      case 'OUTCOME_ENGAGEMENT': return 'CONVERSATIONS';
      case 'OUTCOME_LEADS': return 'LEAD_GENERATION';
      case 'OUTCOME_SALES': return 'OFFSITE_CONVERSIONS';
      case 'OUTCOME_AWARENESS': return 'REACH';
      default: return 'LINK_CLICKS';
    }
  };

  const handleCreate = async () => {
    setShowConfirmDialog(false);
    setIsCreating(true);

    try {
      const targeting: any = {
        geo_locations: { countries: [targetCountry] },
        age_min: parseInt(ageMin),
        age_max: parseInt(ageMax),
      };

      const res = await apiClient.post<any>('/api/ads/campaigns', {
        adAccountId: selectedAccount,
        name: campaignName,
        objective,
        dailyBudget: dailyBudget ? parseInt(dailyBudget) : undefined,
        targeting,
        destinationType: destinationType || undefined,
        optimizationGoal: getOptimizationGoal(),
      });

      if (res.success) {
        toast({ title: 'Campaña creada', description: `${campaignName} creada en PAUSED. Actívala desde Meta Ads Manager.` });
        // Reset form
        setCampaignName('');
        setObjective('');
        setDailyBudget('');
        setDestinationType('');
      }
    } catch (err: any) {
      toast({ title: 'Error al crear campaña', description: err?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = selectedAccount && campaignName && objective;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Nueva Campaña</h2>
        <p className="text-sm text-muted-foreground mb-6">
          La campaña se crea en estado PAUSED. Actívala manualmente cuando esté lista.
        </p>

        <div className="space-y-5">
          {/* Account */}
          <div className="space-y-2">
            <Label>Cuenta de Anuncios *</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.businessName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Nombre de la Campaña *</Label>
            <Input
              placeholder="Ej: Ventas WhatsApp - Marzo 2026"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
            />
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <Label>Objetivo *</Label>
            <div className="grid grid-cols-2 gap-2">
              {objectiveOptions.map(o => (
                <button
                  key={o.value}
                  onClick={() => setObjective(o.value)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                    objective === o.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  <div className="font-medium text-sm text-foreground">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label>Destino</Label>
            <Select value={destinationType} onValueChange={setDestinationType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona destino (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {destinationOptions.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label>Presupuesto Diario (COP)</Label>
            <Input
              type="number"
              placeholder="Ej: 20000"
              value={dailyBudget}
              onChange={e => setDailyBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Si no se especifica, se usa el presupuesto a nivel de campaña (CBO)</p>
          </div>

          {/* Targeting */}
          <div className="space-y-3">
            <Label>Segmentación Básica</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">País</Label>
                <Select value={targetCountry} onValueChange={setTargetCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CO">Colombia</SelectItem>
                    <SelectItem value="MX">México</SelectItem>
                    <SelectItem value="US">Estados Unidos</SelectItem>
                    <SelectItem value="ES">España</SelectItem>
                    <SelectItem value="AR">Argentina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Edad mín.</Label>
                <Input type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} min="13" max="65" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Edad máx.</Label>
                <Input type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} min="13" max="65" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-border">
            <Button
              className="w-full"
              disabled={!canCreate || isCreating}
              onClick={() => setShowConfirmDialog(true)}
            >
              {isCreating ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Crear Campaña</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar creación de campaña</DialogTitle>
            <DialogDescription>
              Se creará la campaña en estado PAUSED. Revísala en Meta Ads Manager antes de activarla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Nombre:</span><span className="font-medium">{campaignName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Objetivo:</span><span className="font-medium">{objectiveLabels[objective] || objective}</span></div>
            {destinationType && <div className="flex justify-between"><span className="text-muted-foreground">Destino:</span><span className="font-medium">{destinationType}</span></div>}
            {dailyBudget && <div className="flex justify-between"><span className="text-muted-foreground">Presupuesto diario:</span><span className="font-medium">{formatCurrency(parseInt(dailyBudget))}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">País:</span><span className="font-medium">{targetCountry}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Edad:</span><span className="font-medium">{ageMin} - {ageMax} años</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────

function StatCard({ icon: Icon, iconColor, bgColor, label, value, sub }: {
  icon: any; iconColor: string; bgColor: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', bgColor)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">
            {value}
            {sub && <span className="text-sm font-normal text-muted-foreground ml-1">{sub}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function CampaignCard({ campaign, onToggle, isToggling }: {
  campaign: Campaign; onToggle: (id: string, status: string) => void; isToggling: boolean;
}) {
  const status = statusConfig[campaign.status] || statusConfig.paused;
  const progress = campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;
  const objectiveLabel = objectiveLabels[campaign.objective] || campaign.objective;

  return (
    <div className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="bg-blue-500/10 text-blue-600 text-xs">Meta</Badge>
            <Badge variant="outline" className={cn('text-xs', status.className)}>{status.label}</Badge>
            <Badge variant="outline" className="text-xs">{objectiveLabel}</Badge>
          </div>
          <h3 className="font-semibold text-foreground truncate" title={campaign.name}>{campaign.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{campaign.client}</p>
        </div>
        <Button
          variant="ghost" size="icon"
          onClick={() => onToggle(campaign.id, campaign.status)}
          disabled={isToggling}
          className={cn('flex-shrink-0', campaign.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success')}
        >
          {isToggling ? <RefreshCw className="h-4 w-4 animate-spin" /> : campaign.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div><p className="text-xs text-muted-foreground">Inversión</p><p className="font-semibold text-foreground">{formatCurrency(campaign.spent)}</p></div>
        <div><p className="text-xs text-muted-foreground">Resultados</p><p className="font-semibold text-foreground">{formatNumber(campaign.results)}</p></div>
        <div><p className="text-xs text-muted-foreground">CPA</p><p className="font-semibold text-foreground">{formatCurrency(campaign.cpa)}</p></div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
        <div><p className="text-muted-foreground">Impresiones</p><p className="font-medium text-foreground">{formatNumber(campaign.impressions)}</p></div>
        <div><p className="text-muted-foreground">Alcance</p><p className="font-medium text-foreground">{formatNumber(campaign.reach)}</p></div>
        <div><p className="text-muted-foreground">CTR</p><p className="font-medium text-foreground">{campaign.ctr.toFixed(2)}%</p></div>
      </div>

      {campaign.budget > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Presupuesto consumido</span>
            <span className="font-medium text-foreground">{Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <Progress
            value={Math.min(progress, 100)}
            className={cn('h-2', progress > 90 ? '[&>div]:bg-destructive' : progress > 70 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
          />
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1">
          <TrendingUp className={cn('h-4 w-4', campaign.roas >= 2 ? 'text-success' : 'text-muted-foreground')} />
          <span className={cn('font-semibold', campaign.roas >= 2 ? 'text-success' : 'text-foreground')}>
            {campaign.roas.toFixed(1)}x ROAS
          </span>
        </div>
        <div className="text-xs text-muted-foreground">CPC: {formatCurrency(campaign.cpc)}</div>
      </div>
    </div>
  );
}

function CampaignTable({ campaigns, onToggle, togglingCampaign }: {
  campaigns: Campaign[]; onToggle: (id: string, status: string) => void; togglingCampaign: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left p-4 text-sm font-semibold">Campaña</th>
              <th className="text-left p-4 text-sm font-semibold">Cuenta</th>
              <th className="text-left p-4 text-sm font-semibold">Estado</th>
              <th className="text-left p-4 text-sm font-semibold">Objetivo</th>
              <th className="text-right p-4 text-sm font-semibold">Inversión</th>
              <th className="text-right p-4 text-sm font-semibold">Resultados</th>
              <th className="text-right p-4 text-sm font-semibold">CPA</th>
              <th className="text-right p-4 text-sm font-semibold">CTR</th>
              <th className="text-right p-4 text-sm font-semibold">ROAS</th>
              <th className="text-center p-4 text-sm font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campaigns.map(c => {
              const status = statusConfig[c.status] || statusConfig.paused;
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4"><div className="font-medium max-w-[200px] truncate" title={c.name}>{c.name}</div></td>
                  <td className="p-4 text-sm text-muted-foreground">{c.client}</td>
                  <td className="p-4"><Badge variant="outline" className={cn('text-xs', status.className)}>{status.label}</Badge></td>
                  <td className="p-4 text-sm text-muted-foreground">{objectiveLabels[c.objective] || c.objective}</td>
                  <td className="p-4 text-right font-medium">{formatCurrency(c.spent)}</td>
                  <td className="p-4 text-right font-medium">{formatNumber(c.results)}</td>
                  <td className="p-4 text-right text-sm text-muted-foreground">{formatCurrency(c.cpa)}</td>
                  <td className="p-4 text-right text-sm text-muted-foreground">{c.ctr.toFixed(2)}%</td>
                  <td className="p-4 text-right">
                    <span className={cn('font-medium', c.roas >= 2 ? 'text-success' : 'text-foreground')}>{c.roas.toFixed(1)}x</span>
                  </td>
                  <td className="p-4 text-center">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => onToggle(c.id, c.status)}
                      disabled={togglingCampaign === c.id}
                      className={cn('h-8 w-8', c.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success')}
                    >
                      {togglingCampaign === c.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : c.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignListView({ campaigns, onToggle, togglingCampaign }: {
  campaigns: Campaign[]; onToggle: (id: string, status: string) => void; togglingCampaign: string | null;
}) {
  return (
    <div className="space-y-2">
      {campaigns.map(c => {
        const status = statusConfig[c.status] || statusConfig.paused;
        const progress = c.budget > 0 ? (c.spent / c.budget) * 100 : 0;
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-all">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 min-w-[100px]">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => onToggle(c.id, c.status)}
                  disabled={togglingCampaign === c.id}
                  className={cn('h-8 w-8 flex-shrink-0', c.status === 'active' ? 'text-warning hover:text-warning' : 'text-success hover:text-success')}
                >
                  {togglingCampaign === c.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : c.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Badge variant="outline" className={cn('text-xs', status.className)}>{status.label}</Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                  <Badge variant="outline" className="text-xs flex-shrink-0">{objectiveLabels[c.objective] || c.objective}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.client}</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right"><p className="text-xs text-muted-foreground">Inversión</p><p className="font-semibold">{formatCurrency(c.spent)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">Resultados</p><p className="font-semibold">{formatNumber(c.results)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">CPA</p><p className="font-medium">{formatCurrency(c.cpa)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">ROAS</p><p className={cn('font-semibold', c.roas >= 2 ? 'text-success' : 'text-foreground')}>{c.roas.toFixed(1)}x</p></div>
              </div>
              {c.budget > 0 && (
                <div className="w-24 flex-shrink-0">
                  <div className="text-xs text-muted-foreground mb-1 text-right">{Math.min(progress, 100).toFixed(0)}%</div>
                  <Progress value={Math.min(progress, 100)} className={cn('h-2', progress > 90 ? '[&>div]:bg-destructive' : progress > 70 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
