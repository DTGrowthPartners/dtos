import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Building2, DollarSign, Calendar, Clock, MessageCircle, ChevronRight, X, MoreHorizontal, Filter, TrendingUp, AlertTriangle, Tag, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

// Types
interface DealStage {
  id: string;
  name: string;
  slug: string;
  position: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  _count?: { deals: number };
}

interface DealAlert {
  type: 'follow_up_overdue' | 'high_value_dormant' | 'no_interaction' | 'meeting_reminder';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
}

interface Deal {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  phoneCountryCode: string;
  email?: string;
  stageId: string;
  stage?: DealStage;
  estimatedValue?: number;
  currency: string;
  serviceId?: string;
  service?: { id: string; name: string; icon: string };
  serviceNotes?: string;
  source?: string;
  sourceDetail?: string;
  ownerId?: string;
  owner?: { id: string; firstName: string; lastName: string; email: string };
  firstContactAt?: string;
  meetingScheduledAt?: string;
  proposalSentAt?: string;
  expectedCloseDate?: string;
  closedAt?: string;
  lostReason?: string;
  lostNotes?: string;
  notes?: string;
  // CRM v2 fields
  probability?: number;
  priority?: string;
  nextFollowUp?: string;
  lastInteractionAt?: string;
  tags?: string[];
  daysSinceInteraction?: number;
  alerts?: DealAlert[];
  // Relations
  activities?: DealActivity[];
  reminders?: DealReminder[];
  nextReminder?: DealReminder;
  daysInStage?: number;
  createdAt: string;
  updatedAt: string;
}

interface DealActivity {
  id: string;
  dealId: string;
  type: string;
  title?: string;
  description?: string;
  fromStage?: { id: string; name: string; color: string };
  toStage?: { id: string; name: string; color: string };
  performedByUser?: { id: string; firstName: string; lastName: string };
  performedAt: string;
}

interface DealReminder {
  id: string;
  dealId: string;
  title: string;
  remindAt: string;
  isCompleted: boolean;
}

interface PipelineMetrics {
  pipelineValue: number;
  activeDeals: number;
  stagesBreakdown: {
    stageId: string;
    stageName: string;
    stageColor: string;
    count: number;
    value: number;
  }[];
  dealsNeedingFollowUp: number;
}

interface Service {
  id: string;
  name: string;
  icon: string;
}

const LOST_REASONS = [
  { value: 'precio', label: 'Precio muy alto' },
  { value: 'competencia', label: 'Eligio competencia' },
  { value: 'timing', label: 'No es el momento' },
  { value: 'no_necesita', label: 'No necesita el servicio' },
  { value: 'sin_respuesta', label: 'No respondio' },
  { value: 'no_califica', label: 'No califica como cliente' },
  { value: 'otro', label: 'Otro' },
];

const DEAL_SOURCES = [
  { value: 'referido', label: 'Referido' },
  { value: 'pauta', label: 'Pauta publicitaria' },
  { value: 'web', label: 'Sitio web' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'evento', label: 'Evento/Networking' },
  { value: 'llamada_fria', label: 'Llamada en frio' },
  { value: 'otro', label: 'Otro' },
];

const DEAL_PRIORITIES = [
  { value: 'baja', label: 'Baja', color: '#6B7280' },
  { value: 'media', label: 'Media', color: '#3B82F6' },
  { value: 'alta', label: 'Alta', color: '#F59E0B' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
];

const getAlertSeverityColor = (severity: string) => {
  switch (severity) {
    case 'urgent': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    default: return 'bg-gray-500 text-white';
  }
};

const getPriorityBadge = (priority: string) => {
  const p = DEAL_PRIORITIES.find(pr => pr.value === priority);
  return p ? { label: p.label, color: p.color } : { label: priority, color: '#6B7280' };
};

const formatCurrency = (value: number, currency: string = 'COP') => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRelativeDate = (date: string) => {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Manana';
  if (days === -1) return 'Ayer';
  if (days > 0) return `En ${days} dias`;
  return `Hace ${Math.abs(days)} dias`;
};

const getWhatsAppUrl = (phone: string, countryCode: string, stageName: string, dealName: string) => {
  const messages: Record<string, string> = {
    'nuevo': `Hola ${dealName}! Soy de DT Growth Partners, vi que estas interesado en nuestros servicios. Tienes un momento para conversar?`,
    'contactado': `Hola ${dealName}! Siguiendo nuestra conversacion, te gustaria agendar una llamada para conocer mas sobre como podemos ayudarte?`,
    'reunion': `Hola ${dealName}! Te confirmo nuestra reunion. Todo bien para la fecha acordada?`,
    'propuesta': `Hola ${dealName}! Te comparto la propuesta que conversamos. Tienes alguna pregunta?`,
    'negociacion': `Hola ${dealName}! Has podido revisar la propuesta? Estoy pendiente de cualquier duda.`,
  };
  const message = messages[stageName] || `Hola ${dealName}!`;
  const fullPhone = `${countryCode}${phone}`.replace(/[^0-9+]/g, '');
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
};

export default function CRM() {
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false);
  const [isWonDialogOpen, setIsWonDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [dealToClose, setDealToClose] = useState<Deal | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    phoneCountryCode: '+57',
    email: '',
    stageId: '',
    estimatedValue: '',
    currency: 'COP',
    serviceId: '',
    serviceNotes: '',
    source: '',
    sourceDetail: '',
    expectedCloseDate: '',
    notes: '',
    // CRM v2 fields
    probability: 50,
    priority: 'media',
    nextFollowUp: '',
    tags: '',
  });

  const [lostFormData, setLostFormData] = useState({
    reason: '',
    notes: '',
  });

  const [wonFormData, setWonFormData] = useState({
    finalValue: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stagesData, dealsData, servicesData, metricsData] = await Promise.all([
        apiClient.get<DealStage[]>('/api/crm/stages'),
        apiClient.get<Deal[]>('/api/crm/deals'),
        apiClient.get<Service[]>('/api/services'),
        apiClient.get<PipelineMetrics>('/api/crm/metrics/pipeline'),
      ]);
      setStages(stagesData);
      setDeals(dealsData);
      setServices(servicesData);
      setMetrics(metricsData);
      if (stagesData.length > 0 && !formData.stageId) {
        setFormData(prev => ({ ...prev, stageId: stagesData[0].id }));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el pipeline',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDealDetail = async (dealId: string) => {
    try {
      const deal = await apiClient.get<Deal>(`/api/crm/deals/${dealId}`);
      setSelectedDeal(deal);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle del deal',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        probability: formData.probability,
        nextFollowUp: formData.nextFollowUp || undefined,
      };

      if (editingDeal) {
        await apiClient.patch(`/api/crm/deals/${editingDeal.id}`, payload);
        toast({ title: 'Deal actualizado', description: 'El prospecto se actualizo correctamente' });
      } else {
        await apiClient.post('/api/crm/deals', payload);
        toast({ title: 'Deal creado', description: 'El prospecto se agrego al pipeline' });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el deal',
        variant: 'destructive',
      });
    }
  };

  const handleChangeStage = async (dealId: string, newStageId: string) => {
    try {
      await apiClient.patch(`/api/crm/deals/${dealId}/stage`, { stageId: newStageId });
      toast({ title: 'Etapa actualizada' });
      loadData();
      if (selectedDeal?.id === dealId) {
        loadDealDetail(dealId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la etapa',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsLost = async () => {
    if (!dealToClose) return;
    try {
      await apiClient.post(`/api/crm/deals/${dealToClose.id}/lost`, lostFormData);
      toast({ title: 'Deal marcado como perdido' });
      setIsLostDialogOpen(false);
      setDealToClose(null);
      setLostFormData({ reason: '', notes: '' });
      loadData();
      if (selectedDeal?.id === dealToClose.id) {
        setSelectedDeal(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar como perdido',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsWon = async () => {
    if (!dealToClose) return;
    try {
      await apiClient.post(`/api/crm/deals/${dealToClose.id}/won`, {
        finalValue: parseFloat(wonFormData.finalValue),
        notes: wonFormData.notes,
      });
      toast({ title: 'Deal ganado!', description: 'Felicidades por cerrar el deal!' });
      setIsWonDialogOpen(false);
      setDealToClose(null);
      setWonFormData({ finalValue: '', notes: '' });
      loadData();
      if (selectedDeal?.id === dealToClose.id) {
        setSelectedDeal(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo marcar como ganado',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm('Estas seguro de eliminar este prospecto?')) return;
    try {
      await apiClient.delete(`/api/crm/deals/${dealId}`);
      toast({ title: 'Deal eliminado' });
      loadData();
      if (selectedDeal?.id === dealId) {
        setSelectedDeal(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el deal',
        variant: 'destructive',
      });
    }
  };

  const handleLogActivity = async (dealId: string, type: string, title: string) => {
    try {
      await apiClient.post(`/api/crm/deals/${dealId}/activities`, { type, title });
      toast({ title: 'Actividad registrada' });
      if (selectedDeal?.id === dealId) {
        loadDealDetail(dealId);
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name,
      company: deal.company || '',
      phone: deal.phone || '',
      phoneCountryCode: deal.phoneCountryCode,
      email: deal.email || '',
      stageId: deal.stageId,
      estimatedValue: deal.estimatedValue?.toString() || '',
      currency: deal.currency,
      serviceId: deal.serviceId || '',
      serviceNotes: deal.serviceNotes || '',
      source: deal.source || '',
      sourceDetail: deal.sourceDetail || '',
      expectedCloseDate: deal.expectedCloseDate?.split('T')[0] || '',
      notes: deal.notes || '',
      // CRM v2 fields
      probability: deal.probability ?? 50,
      priority: deal.priority || 'media',
      nextFollowUp: deal.nextFollowUp?.split('T')[0] || '',
      tags: deal.tags?.join(', ') || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      phone: '',
      phoneCountryCode: '+57',
      email: '',
      stageId: stages[0]?.id || '',
      estimatedValue: '',
      currency: 'COP',
      serviceId: '',
      serviceNotes: '',
      source: '',
      sourceDetail: '',
      expectedCloseDate: '',
      notes: '',
      // CRM v2 fields
      probability: 50,
      priority: 'media',
      nextFollowUp: '',
      tags: '',
    });
    setEditingDeal(null);
  };

  const filteredDeals = deals.filter((deal) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      deal.name.toLowerCase().includes(searchLower) ||
      deal.company?.toLowerCase().includes(searchLower) ||
      deal.email?.toLowerCase().includes(searchLower)
    );
  });

  const getDealsByStage = (stageId: string) => {
    return filteredDeals.filter((deal) => deal.stageId === stageId);
  };

  const activeStages = stages.filter((s) => !s.isWon && !s.isLost);
  const wonStage = stages.find((s) => s.isWon);
  const lostStage = stages.find((s) => s.isLost);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM / Pipeline de Ventas</h1>
          <p className="text-muted-foreground">Gestiona tus prospectos y oportunidades</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Prospecto
        </Button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Deals Activos</span>
              </div>
              <p className="text-2xl font-bold">{metrics.activeDeals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Pipeline Total</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.pipelineValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Necesitan Seguimiento</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{metrics.dealsNeedingFollowUp}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ganados</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {getDealsByStage(wonStage?.id || '').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar prospectos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {activeStages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);

            return (
              <div
                key={stage.id}
                className="w-80 flex-shrink-0 bg-muted/30 rounded-lg p-3"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(stageValue)}
                  </span>
                </div>

                {/* Deals */}
                <div className="space-y-3">
                  {stageDeals.map((deal) => {
                    const priorityInfo = getPriorityBadge(deal.priority || 'media');
                    const hasUrgentAlert = deal.alerts?.some(a => a.severity === 'urgent');

                    return (
                    <Card
                      key={deal.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${hasUrgentAlert ? 'border-red-400 border-2' : ''}`}
                      onClick={() => loadDealDetail(deal.id)}
                    >
                      <CardContent className="p-3">
                        {/* Alerts Banner */}
                        {deal.alerts && deal.alerts.length > 0 && (
                          <div className="mb-2 -mt-1 -mx-1">
                            {deal.alerts.slice(0, 2).map((alert, idx) => (
                              <div key={idx} className={`text-xs px-2 py-0.5 ${getAlertSeverityColor(alert.severity)} ${idx === 0 ? 'rounded-t' : ''}`}>
                                <AlertTriangle className="h-3 w-3 inline mr-1" />
                                {alert.message}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-sm">{deal.name}</h4>
                            {deal.company && (
                              <p className="text-xs text-muted-foreground">{deal.company}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {deal.priority && deal.priority !== 'media' && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: priorityInfo.color, color: priorityInfo.color }}
                              >
                                {priorityInfo.label}
                              </Badge>
                            )}
                            {deal.daysInStage && deal.daysInStage > 5 && (
                              <Badge variant="outline" className="text-xs text-yellow-600">
                                {deal.daysInStage}d
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          {deal.estimatedValue && (
                            <span className="text-xs font-medium text-green-600">
                              {formatCurrency(deal.estimatedValue, deal.currency)}
                            </span>
                          )}
                          {deal.probability !== undefined && deal.probability !== 50 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Gauge className="h-3 w-3" />
                              {deal.probability}%
                            </span>
                          )}
                        </div>

                        <div className="flex items-center flex-wrap gap-1 mb-3">
                          {deal.service && (
                            <Badge variant="secondary" className="text-xs">
                              {deal.service.name}
                            </Badge>
                          )}
                          {deal.tags && deal.tags.slice(0, 2).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <Tag className="h-2 w-2 mr-0.5" />
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {deal.phone && (
                            <a
                              href={getWhatsAppUrl(deal.phone, deal.phoneCountryCode, stage.slug, deal.name.split(' ')[0])}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleLogActivity(deal.id, 'whatsapp', 'Mensaje WhatsApp')}
                              className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition-colors"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          {deal.phone && (
                            <a
                              href={`tel:${deal.phoneCountryCode}${deal.phone}`}
                              onClick={() => handleLogActivity(deal.id, 'call', 'Llamada')}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                            >
                              <Phone className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {(deal.nextReminder || deal.nextFollowUp) && (
                          <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {deal.nextFollowUp
                                ? `Seguimiento: ${formatRelativeDate(deal.nextFollowUp)}`
                                : deal.nextReminder && formatRelativeDate(deal.nextReminder.remindAt)
                              }
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                  })}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Sin prospectos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedDeal && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle>{selectedDeal.name}</SheetTitle>
                    {selectedDeal.company && (
                      <p className="text-sm text-muted-foreground">{selectedDeal.company}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(selectedDeal)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => { setDealToClose(selectedDeal); setWonFormData({ finalValue: selectedDeal.estimatedValue?.toString() || '', notes: '' }); setIsWonDialogOpen(true); }}
                        className="text-green-600"
                      >
                        Marcar como Ganado
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setDealToClose(selectedDeal); setIsLostDialogOpen(true); }}
                        className="text-red-600"
                      >
                        Marcar como Perdido
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(selectedDeal.id)}
                        className="text-destructive"
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Stage Selector */}
                <div>
                  <Label className="text-xs text-muted-foreground">Etapa</Label>
                  <Select
                    value={selectedDeal.stageId}
                    onValueChange={(value) => handleChangeStage(selectedDeal.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Informacion de Contacto</h4>
                  {selectedDeal.phone && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDeal.phoneCountryCode} {selectedDeal.phone}</span>
                      </div>
                      <div className="flex gap-1">
                        <a
                          href={getWhatsAppUrl(selectedDeal.phone, selectedDeal.phoneCountryCode, selectedDeal.stage?.slug || '', selectedDeal.name.split(' ')[0])}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleLogActivity(selectedDeal.id, 'whatsapp', 'Mensaje WhatsApp')}
                        >
                          <Button size="sm" className="bg-green-500 hover:bg-green-600">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </a>
                        <a href={`tel:${selectedDeal.phoneCountryCode}${selectedDeal.phone}`}>
                          <Button size="sm" variant="outline">
                            <Phone className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedDeal.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDeal.email}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Deal Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Oportunidad</h4>
                  {selectedDeal.estimatedValue && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Valor estimado: {formatCurrency(selectedDeal.estimatedValue, selectedDeal.currency)}</span>
                    </div>
                  )}
                  {selectedDeal.service && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Servicio: {selectedDeal.service.name}</span>
                    </div>
                  )}
                  {selectedDeal.expectedCloseDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Cierre esperado: {new Date(selectedDeal.expectedCloseDate).toLocaleDateString('es-CO')}</span>
                    </div>
                  )}
                  {selectedDeal.source && (
                    <div className="flex items-center gap-2 text-sm">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span>Fuente: {DEAL_SOURCES.find(s => s.value === selectedDeal.source)?.label || selectedDeal.source}</span>
                      {selectedDeal.sourceDetail && <span className="text-muted-foreground">({selectedDeal.sourceDetail})</span>}
                    </div>
                  )}
                  {selectedDeal.notes && (
                    <div className="text-sm">
                      <p className="text-muted-foreground">Notas:</p>
                      <p>{selectedDeal.notes}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Activity Timeline */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Actividad Reciente</h4>
                  <ScrollArea className="h-64">
                    {selectedDeal.activities && selectedDeal.activities.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDeal.activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              {activity.type === 'whatsapp' && <MessageCircle className="h-4 w-4 text-green-500" />}
                              {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-500" />}
                              {activity.type === 'email' && <Mail className="h-4 w-4 text-purple-500" />}
                              {activity.type === 'stage_change' && <ChevronRight className="h-4 w-4 text-orange-500" />}
                              {activity.type === 'note' && <Building2 className="h-4 w-4 text-gray-500" />}
                              {activity.type === 'meeting' && <Calendar className="h-4 w-4 text-pink-500" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{activity.title}</p>
                              {activity.description && (
                                <p className="text-muted-foreground">{activity.description}</p>
                              )}
                              {activity.type === 'stage_change' && activity.fromStage && activity.toStage && (
                                <div className="flex items-center gap-1 text-xs mt-1">
                                  <Badge variant="outline" style={{ borderColor: activity.fromStage.color }}>
                                    {activity.fromStage.name}
                                  </Badge>
                                  <ChevronRight className="h-3 w-3" />
                                  <Badge variant="outline" style={{ borderColor: activity.toStage.color }}>
                                    {activity.toStage.name}
                                  </Badge>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(activity.performedAt).toLocaleString('es-CO')}
                                {activity.performedByUser && ` - ${activity.performedByUser.firstName}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sin actividad registrada
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Editar Prospecto' : 'Nuevo Prospecto'}</DialogTitle>
            <DialogDescription>
              {editingDeal ? 'Actualiza la informacion del prospecto' : 'Agrega un nuevo prospecto al pipeline'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del contacto *</Label>
                  <Input
                    id="name"
                    placeholder="Juan Perez"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    placeholder="Mi Empresa S.A.S"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneCountryCode">Codigo</Label>
                  <Select
                    value={formData.phoneCountryCode}
                    onValueChange={(value) => setFormData({ ...formData, phoneCountryCode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+57">+57 (CO)</SelectItem>
                      <SelectItem value="+1">+1 (US)</SelectItem>
                      <SelectItem value="+34">+34 (ES)</SelectItem>
                      <SelectItem value="+52">+52 (MX)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    placeholder="300 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="juan@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimatedValue">Valor estimado mensual</Label>
                  <Input
                    id="estimatedValue"
                    type="number"
                    placeholder="2500000"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceId">Servicio de interes</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Fuente</Label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) => setFormData({ ...formData, source: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Como llego" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_SOURCES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceDetail">Detalle de fuente</Label>
                  <Input
                    id="sourceDetail"
                    placeholder="Ej: Referido por Juan"
                    value={formData.sourceDetail}
                    onChange={(e) => setFormData({ ...formData, sourceDetail: e.target.value })}
                  />
                </div>
              </div>

              {/* CRM v2 Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: priority.color }} />
                            {priority.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextFollowUp">Proximo seguimiento</Label>
                  <Input
                    id="nextFollowUp"
                    type="date"
                    value={formData.nextFollowUp}
                    onChange={(e) => setFormData({ ...formData, nextFollowUp: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="probability">Probabilidad de cierre: {formData.probability}%</Label>
                <Slider
                  value={[formData.probability]}
                  onValueChange={(value) => setFormData({ ...formData, probability: value[0] })}
                  max={100}
                  step={5}
                  className="py-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
                <Input
                  id="tags"
                  placeholder="vip, urgente, descuento"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedCloseDate">Fecha esperada de cierre</Label>
                <Input
                  id="expectedCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas adicionales sobre el prospecto..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingDeal ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lost Dialog */}
      <Dialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Perdido</DialogTitle>
            <DialogDescription>
              Indica la razon por la que se perdio este deal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Razon *</Label>
              <Select
                value={lostFormData.reason}
                onValueChange={(value) => setLostFormData({ ...lostFormData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar razon" />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas adicionales</Label>
              <Textarea
                placeholder="Detalles adicionales..."
                value={lostFormData.notes}
                onChange={(e) => setLostFormData({ ...lostFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsLostDialogOpen(false); setDealToClose(null); }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleMarkAsLost} disabled={!lostFormData.reason}>
              Marcar como Perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Won Dialog */}
      <Dialog open={isWonDialogOpen} onOpenChange={setIsWonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Ganado</DialogTitle>
            <DialogDescription>
              Felicidades! Confirma el valor final del deal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor final *</Label>
              <Input
                type="number"
                placeholder="2500000"
                value={wonFormData.finalValue}
                onChange={(e) => setWonFormData({ ...wonFormData, finalValue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Detalles del cierre..."
                value={wonFormData.notes}
                onChange={(e) => setWonFormData({ ...wonFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsWonDialogOpen(false); setDealToClose(null); }}>
              Cancelar
            </Button>
            <Button className="bg-green-500 hover:bg-green-600" onClick={handleMarkAsWon} disabled={!wonFormData.finalValue}>
              Confirmar Ganado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
