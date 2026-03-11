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
  return (
    <div className="space-y-6 animate-fade-in">
      <CreateCampaignTab />
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

// ─── Campaign Templates ───────────────────────────────────

interface CampaignTemplate {
  id: string;
  name: string;
  category: 'trafico' | 'ventas' | 'leads' | 'interaccion' | 'reconocimiento';
  categoryLabel: string;
  categoryColor: string;
  description: string;
  icon: string;
  objective: string;
  destination: string;
  requirements: string[];
  ctas: string[];
  budgetSuggested: number;
}

const TEMPLATES: CampaignTemplate[] = [
  {
    id: 'trafico-web',
    name: 'Tráfico a Sitio Web',
    category: 'trafico', categoryLabel: 'TRÁFICO', categoryColor: 'bg-blue-500/20 text-blue-400',
    description: 'Lleva visitantes a tu sitio web o landing page. Optimizado para vistas de página.',
    icon: '🌐', objective: 'OUTCOME_TRAFFIC', destination: 'WEBSITE',
    requirements: ['URL'],
    ctas: ['Más información', 'Registrarse', 'Obtener cotización'],
    budgetSuggested: 20000,
  },
  {
    id: 'ventas-whatsapp',
    name: 'Ventas WhatsApp',
    category: 'ventas', categoryLabel: 'VENTAS', categoryColor: 'bg-green-500/20 text-green-400',
    description: 'Genera ventas directamente por WhatsApp. Meta optimiza para personas con alta intención de compra que inicien conversación.',
    icon: '💰', objective: 'OUTCOME_SALES', destination: 'WHATSAPP',
    requirements: ['WhatsApp'],
    ctas: ['WhatsApp', 'Comprar', 'Obtener cotización'],
    budgetSuggested: 20000,
  },
  {
    id: 'leads-whatsapp',
    name: 'Leads por WhatsApp',
    category: 'leads', categoryLabel: 'CLIENTES POTENCIALES', categoryColor: 'bg-purple-500/20 text-purple-400',
    description: 'Captura leads calificados a través de WhatsApp. Meta optimiza para personas que probablemente te escriban.',
    icon: '📋', objective: 'OUTCOME_LEADS', destination: 'WHATSAPP',
    requirements: ['WhatsApp'],
    ctas: ['WhatsApp', 'Obtener cotización', 'Contactar'],
    budgetSuggested: 20000,
  },
  {
    id: 'conversiones-web',
    name: 'Conversiones Web',
    category: 'ventas', categoryLabel: 'VENTAS', categoryColor: 'bg-green-500/20 text-green-400',
    description: 'Genera ventas y conversiones en tu sitio web. Meta busca personas con alta intención de compra.',
    icon: '💰', objective: 'OUTCOME_SALES', destination: 'WEBSITE',
    requirements: ['Pixel', 'URL'],
    ctas: ['Comprar', 'Comprar ahora', 'Obtener oferta'],
    budgetSuggested: 20000,
  },
  {
    id: 'mensajes-whatsapp',
    name: 'Mensajes WhatsApp',
    category: 'interaccion', categoryLabel: 'INTERACCIÓN', categoryColor: 'bg-yellow-500/20 text-yellow-400',
    description: 'Maximiza conversaciones en WhatsApp. Meta optimiza para personas que probablemente inicien un chat.',
    icon: '💬', objective: 'OUTCOME_ENGAGEMENT', destination: 'WHATSAPP',
    requirements: ['WhatsApp'],
    ctas: ['WhatsApp', 'Enviar mensaje (Messenger)', 'Contactar'],
    budgetSuggested: 20000,
  },
  {
    id: 'trafico-instagram',
    name: 'Tráfico a Perfil Instagram',
    category: 'trafico', categoryLabel: 'TRÁFICO', categoryColor: 'bg-blue-500/20 text-blue-400',
    description: 'Lleva personas a tu perfil de Instagram para ganar seguidores y visibilidad. Meta optimiza para visitas al perfil.',
    icon: '📱', objective: 'OUTCOME_TRAFFIC', destination: 'INSTAGRAM_PROFILE',
    requirements: [],
    ctas: ['Ir al perfil de Instagram'],
    budgetSuggested: 20000,
  },
  {
    id: 'mensajes-instagram',
    name: 'Mensajes Instagram',
    category: 'interaccion', categoryLabel: 'INTERACCIÓN', categoryColor: 'bg-yellow-500/20 text-yellow-400',
    description: 'Genera mensajes directos en Instagram. Meta optimiza para personas que abran conversación en tus DMs.',
    icon: '📸', objective: 'OUTCOME_ENGAGEMENT', destination: 'INSTAGRAM_DIRECT',
    requirements: [],
    ctas: ['Enviar mensaje (Instagram)', 'Contactar', 'Obtener cotización'],
    budgetSuggested: 20000,
  },
  {
    id: 'ventas-instagram-dm',
    name: 'Ventas Instagram DM',
    category: 'ventas', categoryLabel: 'VENTAS', categoryColor: 'bg-green-500/20 text-green-400',
    description: 'Genera ventas directamente por DM de Instagram. Meta optimiza para personas con alta intención de compra que inicien conversación.',
    icon: '💰', objective: 'OUTCOME_SALES', destination: 'INSTAGRAM_DIRECT',
    requirements: [],
    ctas: ['Enviar mensaje (Instagram)', 'Comprar', 'Obtener cotización'],
    budgetSuggested: 20000,
  },
  {
    id: 'reconocimiento-thruplay',
    name: 'Reconocimiento ThruPlay',
    category: 'reconocimiento', categoryLabel: 'RECONOCIMIENTO', categoryColor: 'bg-red-500/20 text-red-400',
    description: 'Maximiza reproducciones de video (ThruPlay) para reconocimiento de marca. Dirige a Messenger para iniciar conversaciones con personas interesadas.',
    icon: '📣', objective: 'OUTCOME_AWARENESS', destination: 'MESSENGER',
    requirements: [],
    ctas: ['Enviar mensaje (Messenger)', 'Más información', 'Contactar'],
    budgetSuggested: 20000,
  },
];

const TEMPLATE_CATEGORIES = [
  { value: 'todas', label: 'Todas' },
  { value: 'trafico', label: 'Tráfico' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'leads', label: 'Clientes potenciales' },
  { value: 'interaccion', label: 'Interacción' },
  { value: 'reconocimiento', label: 'Reconocimiento' },
];

function CreateCampaignTab() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('todas');

  // Step 2 form
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState('20000');
  const [targetCountry, setTargetCountry] = useState('CO');
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('65');

  // Step 3
  const [isCreating, setIsCreating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadAccounts = () => {
    if (accountsLoaded) return;
    apiClient.get<any>('/api/ads/ad-accounts')
      .then(data => {
        if (data.success) setAccounts((data.accounts || []).filter((a: AdAccount) => a.account_status === 1));
      })
      .catch(() => toast({ title: 'Error', description: 'No se pudieron cargar las cuentas', variant: 'destructive' }))
      .finally(() => setAccountsLoaded(true));
  };

  const handleSelectTemplate = (tpl: CampaignTemplate) => {
    setSelectedTemplate(tpl);
    setCampaignName(`${tpl.name} - ${new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`);
    loadAccounts();
    setStep(2);
  };

  const getOptimizationGoal = () => {
    switch (selectedTemplate?.objective) {
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
      const res = await apiClient.post<any>('/api/ads/campaigns', {
        adAccountId: selectedAccount,
        name: campaignName,
        objective: selectedTemplate?.objective,
        dailyBudget: dailyBudget ? parseInt(dailyBudget) : undefined,
        targeting: { geo_locations: { countries: [targetCountry] }, age_min: parseInt(ageMin), age_max: parseInt(ageMax) },
        destinationType: selectedTemplate?.destination || undefined,
        optimizationGoal: getOptimizationGoal(),
      });
      if (res.success) {
        toast({ title: '¡Campaña creada!', description: `${campaignName} creada en PAUSED. Actívala desde Meta Ads Manager.` });
        setStep(1);
        setSelectedTemplate(null);
        setCampaignName('');
        setDailyBudget('20000');
      }
    } catch (err: any) {
      toast({ title: 'Error al crear campaña', description: err?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTemplates = categoryFilter === 'todas'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === categoryFilter);

  const canContinue = selectedAccount && campaignName;

  // ── Stepper ──
  const steps = [
    { n: 1, label: 'Plantilla' },
    { n: 2, label: 'Configurar' },
    { n: 3, label: 'Crear' },
  ];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                step === s.n ? 'bg-primary text-primary-foreground' :
                step > s.n ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {s.n}
              </div>
              <span className={cn(
                'text-sm font-medium transition-colors',
                step === s.n ? 'text-foreground' : step > s.n ? 'text-primary' : 'text-muted-foreground'
              )}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('mx-4 h-px w-16 transition-colors', step > s.n ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Template Selection ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Selecciona una Plantilla</h2>
            <p className="text-sm text-muted-foreground mt-1">Elige el tipo de campaña que quieres crear. Ya viene pre-configurada.</p>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  categoryFilter === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Templates grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/50 hover:bg-muted/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tpl.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{tpl.name}</h3>
                      <span className={cn('inline-block mt-0.5 rounded px-2 py-0.5 text-xs font-bold', tpl.categoryColor)}>
                        {tpl.categoryLabel}
                      </span>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{tpl.description}</p>
                {tpl.requirements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tpl.requirements.map(r => (
                      <span key={r} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{r}</span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Presupuesto:</span> ${tpl.budgetSuggested.toLocaleString()} COP/día
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium">CTAs:</span> {tpl.ctas.join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Configure ── */}
      {step === 2 && selectedTemplate && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground transition-colors text-sm">← Volver</button>
            <div>
              <h2 className="text-xl font-bold text-foreground">Configurar Campaña</h2>
              <p className="text-sm text-muted-foreground">Plantilla: <span className="text-foreground font-medium">{selectedTemplate.name}</span></p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {/* Account */}
            <div className="space-y-2">
              <Label>Cuenta de Anuncios *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.businessName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nombre de la Campaña *</Label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ej: Ventas WhatsApp - Marzo 2026" />
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label>Presupuesto Diario (COP)</Label>
              <Input type="number" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} placeholder="20000" />
              <p className="text-xs text-muted-foreground">Si no se especifica, se usa presupuesto a nivel de campaña (CBO)</p>
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

            <div className="pt-2">
              <Button className="w-full" disabled={!canContinue} onClick={() => setStep(3)}>
                Continuar → Revisar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Create ── */}
      {step === 3 && selectedTemplate && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(2)} className="text-muted-foreground hover:text-foreground transition-colors text-sm">← Volver</button>
            <div>
              <h2 className="text-xl font-bold text-foreground">Revisar y Crear</h2>
              <p className="text-sm text-muted-foreground">La campaña se creará en estado PAUSED</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <span className="text-2xl">{selectedTemplate.icon}</span>
              <div>
                <p className="font-semibold text-foreground">{selectedTemplate.name}</p>
                <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-bold', selectedTemplate.categoryColor)}>
                  {selectedTemplate.categoryLabel}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {[
                { label: 'Nombre', value: campaignName },
                { label: 'Cuenta', value: accounts.find(a => a.id === selectedAccount)?.name || selectedAccount },
                { label: 'Objetivo', value: objectiveLabels[selectedTemplate.objective] || selectedTemplate.objective },
                { label: 'Presupuesto diario', value: dailyBudget ? `$${parseInt(dailyBudget).toLocaleString()} COP` : 'CBO' },
                { label: 'País', value: targetCountry },
                { label: 'Edad', value: `${ageMin} - ${ageMax} años` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <Button className="w-full" disabled={isCreating} onClick={handleCreate}>
                {isCreating ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creando campaña...</>
                ) : (
                  <><Megaphone className="h-4 w-4 mr-2" /> Crear Campaña</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
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
