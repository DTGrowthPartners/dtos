import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Calendar, DollarSign, Edit, Trash2, Clock, AlertCircle, Percent, Calculator, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  icon: string;
}

interface ClientService {
  id: string;
  clientId: string;
  serviceId: string;
  service: Service;
  precioCliente?: number;
  moneda: string;
  frecuencia: string;
  fechaInicio: string;
  fechaProximoCobro?: string;
  fechaVencimiento?: string;
  estado: string;
  notas?: string;
  esComision?: boolean;
  porcentajeComision?: number;
}

interface ComisionCalc {
  cliente: string;
  periodo: string;
  porcentaje: number | null;
  metaConectado: boolean;
  fuente: 'meta' | 'manual';
  inversion: number | null;
  comision: number | null;
  campanas: { name: string; spend: number }[];
}

interface Client {
  id: string;
  name: string;
}

interface ClientServicesManagerProps {
  client: Client;
  onUpdate?: () => void;
}

const FRECUENCIAS = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Pago único (proyecto)' },
];

const ESTADOS = [
  { value: 'activo', label: 'Activo', color: 'bg-green-100 text-green-800' },
  { value: 'pausado', label: 'Pausado', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
];

const MONEDAS = [
  { value: 'COP', label: 'COP - Peso Colombiano', symbol: '$' },
  { value: 'USD', label: 'USD - Dólar Americano', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'MXN', label: 'MXN - Peso Mexicano', symbol: '$' },
];

const formatCurrency = (amount: number, currency: string = 'COP') => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function ClientServicesManager({ client, onUpdate }: ClientServicesManagerProps) {
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClientService | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');

  const [formData, setFormData] = useState({
    serviceId: '',
    precioCliente: '',
    moneda: 'COP',
    frecuencia: 'mensual',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaProximoCobro: '',
    fechaVencimiento: '',
    notas: '',
    esComision: false,
    porcentaje: '',
  });

  // Calculadora de comisión (spend de Meta → % → cuenta de cobro)
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcSvc, setCalcSvc] = useState<ClientService | null>(null);
  const [calcPeriodo, setCalcPeriodo] = useState<'this_month' | 'last_month'>('last_month');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcData, setCalcData] = useState<ComisionCalc | null>(null);
  const [calcInversion, setCalcInversion] = useState('');

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchClientServices();
    fetchAvailableServices();
  }, [client.id]);

  const fetchClientServices = async () => {
    try {
      const data = await apiClient.get<ClientService[]>(`/api/clients/${client.id}/services`);
      setClientServices(data);
    } catch (error) {
      console.error('Error fetching client services:', error);
    }
  };

  const fetchAvailableServices = async () => {
    try {
      const data = await apiClient.get<Service[]>('/api/services');
      setAvailableServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Servicio adicional al vuelo: si el usuario escribió un nombre nuevo, se crea
      // primero en el catálogo y se asigna al cliente.
      let serviceId = formData.serviceId;
      if (!editingService && creatingNew && newServiceName.trim()) {
        const created = await apiClient.post<{ id: string }>('/api/services', {
          name: newServiceName.trim(),
          price: formData.precioCliente ? parseFloat(formData.precioCliente) : 0,
          currency: formData.moneda,
          status: 'active',
        });
        serviceId = created.id;
        await fetchAvailableServices();
      }

      const payload = {
        serviceId,
        precioCliente: formData.precioCliente ? parseFloat(formData.precioCliente) : undefined,
        moneda: formData.moneda,
        frecuencia: formData.frecuencia,
        fechaInicio: formData.fechaInicio,
        fechaProximoCobro: formData.fechaProximoCobro || undefined,
        fechaVencimiento: formData.fechaVencimiento || undefined,
        notas: formData.notas || undefined,
        esComision: formData.esComision,
        porcentajeComision: formData.esComision && formData.porcentaje ? parseFloat(formData.porcentaje) : undefined,
      };

      if (editingService) {
        await apiClient.put(`/api/clients/${client.id}/services/${editingService.serviceId}`, payload);
        toast({ title: 'Servicio actualizado' });
      } else {
        await apiClient.post(`/api/clients/${client.id}/services`, payload);
        toast({ title: 'Servicio asignado' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchClientServices();
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cs: ClientService) => {
    setEditingService(cs);
    setFormData({
      serviceId: cs.serviceId,
      precioCliente: cs.precioCliente?.toString() || '',
      moneda: cs.moneda || 'COP',
      frecuencia: cs.frecuencia,
      fechaInicio: cs.fechaInicio.split('T')[0],
      fechaProximoCobro: cs.fechaProximoCobro?.split('T')[0] || '',
      fechaVencimiento: cs.fechaVencimiento?.split('T')[0] || '',
      notas: cs.notas || '',
      esComision: !!cs.esComision,
      porcentaje: cs.porcentajeComision?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Quitar este servicio del cliente?')) return;

    try {
      await apiClient.delete(`/api/clients/${client.id}/services/${serviceId}`);
      toast({ title: 'Servicio removido' });
      fetchClientServices();
      onUpdate?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo remover el servicio',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      serviceId: '',
      precioCliente: '',
      moneda: 'COP',
      frecuencia: 'mensual',
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaProximoCobro: '',
      fechaVencimiento: '',
      notas: '',
      esComision: false,
      porcentaje: '',
    });
    setEditingService(null);
    setCreatingNew(false);
    setNewServiceName('');
  };

  // --- Calculadora de comisión ---
  const openCalc = (cs: ClientService) => {
    setCalcSvc(cs);
    setCalcPeriodo('last_month');
    setCalcData(null);
    setCalcInversion('');
    setCalcOpen(true);
    fetchComision('last_month');
  };

  const fetchComision = async (periodo: 'this_month' | 'last_month') => {
    setCalcLoading(true);
    try {
      const d = await apiClient.get<ComisionCalc>(`/api/clients/${client.id}/comision?periodo=${periodo}`);
      setCalcData(d);
      if (d.inversion != null) setCalcInversion(String(d.inversion));
    } catch {
      setCalcData(null);
    } finally {
      setCalcLoading(false);
    }
  };

  const pctOf = (cs: ClientService | null) => cs?.porcentajeComision || calcData?.porcentaje || 0;
  const inversionNum = parseFloat(calcInversion) || 0;
  const comisionNum = Math.round((inversionNum * pctOf(calcSvc)) / 100);

  const generarCuentaComision = () => {
    if (!calcSvc || comisionNum <= 0) return;
    const periodoLabel = calcPeriodo === 'last_month' ? 'mes anterior' : 'mes en curso';
    const desc = `Comisión ${pctOf(calcSvc)}% sobre inversión en pauta (${periodoLabel}) — inversión $${inversionNum.toLocaleString('es-CO')}`;
    const q = new URLSearchParams({
      nueva: '1',
      cliente: client.name,
      concepto: desc,
      items: JSON.stringify([{ descripcion: desc, cantidad: 1, precio_unitario: comisionNum }]),
    });
    setCalcOpen(false);
    navigate(`/cuentas-cobro?${q.toString()}`);
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS.find(e => e.value === estado) || ESTADOS[0];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const selectedService = availableServices.find(s => s.id === formData.serviceId);
  const assignedServiceIds = clientServices.map(cs => cs.serviceId);
  const unassignedServices = availableServices.filter(s => !assignedServiceIds.includes(s.id));

  // Calcular totales (comisión no suma: valor variable según inversión)
  const totalMensual = clientServices
    .filter(cs => cs.estado === 'activo' && !cs.esComision)
    .reduce((sum, cs) => {
      const precio = cs.precioCliente ?? cs.service.price;
      switch (cs.frecuencia) {
        case 'semanal': return sum + precio * 4.333; // ~4.33 semanas/mes
        case 'quincenal': return sum + precio * 2; // 2 pagos por mes
        case 'mensual': return sum + precio;
        case 'trimestral': return sum + precio / 3;
        case 'semestral': return sum + precio / 6;
        case 'anual': return sum + precio / 12;
        default: return sum;
      }
    }, 0);

  return (
    <div className="space-y-4">
      {/* Header con totales */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {clientServices.length} servicio{clientServices.length !== 1 ? 's' : ''} contratado{clientServices.length !== 1 ? 's' : ''}
          </p>
          {totalMensual > 0 && (
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(totalMensual)} /mes
            </p>
          )}
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Servicio
        </Button>
      </div>

      {/* Lista de servicios */}
      {clientServices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay servicios asignados</p>
            <Button variant="link" onClick={() => setIsDialogOpen(true)} className="mt-2">
              Agregar primer servicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clientServices.map((cs) => {
            const precio = cs.precioCliente ?? cs.service.price;
            const isProximoCobro = cs.fechaProximoCobro && new Date(cs.fechaProximoCobro) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            return (
              <Card key={cs.id} className={cs.estado !== 'activo' ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <span className="font-medium">{cs.service.name}</span>
                        {getEstadoBadge(cs.estado)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          {cs.esComision ? (
                            <>
                              <Percent className="h-3 w-3 text-violet-400" />
                              <span className="text-violet-400 font-medium">{cs.porcentajeComision || '?'}% de inversión</span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3" />
                              <span>{formatCurrency(precio, cs.moneda || 'COP')}</span>
                              {cs.precioCliente && (
                                <span className="text-xs line-through text-muted-foreground/50">
                                  {formatCurrency(cs.service.price, cs.service.currency)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{cs.esComision ? 'Variable · cierre de pauta' : FRECUENCIAS.find(f => f.value === cs.frecuencia)?.label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Inicio: {formatDate(cs.fechaInicio)}</span>
                        </div>
                        {cs.fechaProximoCobro && (
                          <div className={`flex items-center gap-1 ${isProximoCobro ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {isProximoCobro && <AlertCircle className="h-3 w-3" />}
                            <span>Cobro: {formatDate(cs.fechaProximoCobro)}</span>
                          </div>
                        )}
                      </div>

                      {cs.notas && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{cs.notas}</p>
                      )}
                    </div>

                    <div className="flex gap-1">
                      {cs.esComision && (
                        <Button variant="outline" size="sm" className="gap-1.5 text-violet-400 border-violet-500/40 hover:bg-violet-500/10" onClick={() => openCalc(cs)}>
                          <Calculator className="h-4 w-4" /> Calcular
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cs)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(cs.serviceId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog para agregar/editar servicio */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Servicio' : 'Agregar Servicio'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'Modifica los detalles del servicio' : `Asignar servicio a ${client.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Selector de servicio (del catálogo) o crear uno nuevo al vuelo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Servicio *</Label>
                  {!editingService && (
                    <button
                      type="button"
                      onClick={() => { setCreatingNew(!creatingNew); setFormData({ ...formData, serviceId: '' }); setNewServiceName(''); }}
                      className="text-xs text-primary hover:underline"
                    >
                      {creatingNew ? '← Elegir del catálogo' : '+ Crear servicio nuevo'}
                    </button>
                  )}
                </div>
                {creatingNew && !editingService ? (
                  <Input
                    placeholder="Nombre del servicio adicional"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <Select
                    value={formData.serviceId}
                    onValueChange={(value) => {
                      const service = availableServices.find(s => s.id === value);
                      setFormData({
                        ...formData,
                        serviceId: value,
                        precioCliente: service?.price.toString() || '',
                      });
                    }}
                    disabled={!!editingService}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {(editingService ? availableServices : unassignedServices).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - {formatCurrency(service.price, service.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Precio y Moneda */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Precio para este cliente</Label>
                  <Input
                    type="number"
                    placeholder={selectedService ? `Default: ${selectedService.price}` : 'Precio'}
                    value={formData.precioCliente}
                    onChange={(e) => setFormData({ ...formData, precioCliente: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={formData.moneda}
                    onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Dejar vacio el precio para usar el estandar del servicio</p>

              {/* Frecuencia */}
              <div className="space-y-2">
                <Label>Frecuencia de pago</Label>
                <Select
                  value={formData.frecuencia}
                  onValueChange={(value) => setFormData({ ...formData, frecuencia: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cobro por comisión (% de la inversión en pauta) */}
              <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.esComision}
                    onChange={(e) => setFormData({ ...formData, esComision: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                    disabled={isLoading}
                  />
                  Cobro por comisión (% de la inversión en pauta)
                </label>
                {formData.esComision && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs">Porcentaje (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      placeholder="10"
                      value={formData.porcentaje}
                      onChange={(e) => setFormData({ ...formData, porcentaje: e.target.value })}
                      disabled={isLoading}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      El valor NO es fijo: al cierre de la pauta se calcula el % sobre lo invertido
                      (con el spend de Meta si el cliente está conectado) y se genera la cuenta de cobro.
                    </p>
                  </div>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input
                    type="date"
                    value={formData.fechaInicio}
                    onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proximo cobro</Label>
                  <Input
                    type="date"
                    value={formData.fechaProximoCobro}
                    onChange={(e) => setFormData({ ...formData, fechaProximoCobro: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fecha vencimiento (opcional)</Label>
                <Input
                  type="date"
                  value={formData.fechaVencimiento}
                  onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                />
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas sobre el servicio..."
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || (!formData.serviceId && !(creatingNew && newServiceName.trim()))}>
                {isLoading ? 'Guardando...' : editingService ? 'Actualizar' : 'Agregar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Calculadora de comisión: inversión (Meta o manual) → % → cuenta de cobro */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-violet-400" /> Calcular comisión
            </DialogTitle>
            <DialogDescription>
              {calcSvc?.porcentajeComision || '?'}% sobre la inversión en pauta de {client.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Periodo de la pauta</Label>
              <Select value={calcPeriodo} onValueChange={(v) => { setCalcPeriodo(v as 'this_month' | 'last_month'); fetchComision(v as 'this_month' | 'last_month'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_month">Mes anterior</SelectItem>
                  <SelectItem value="this_month">Mes en curso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {calcLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Consultando inversión en Meta…
              </div>
            ) : calcData?.fuente === 'meta' && calcData.inversion != null ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Inversión traída de Meta Ads ({calcData.campanas.length} campaña{calcData.campanas.length === 1 ? '' : 's'} con gasto). Puedes ajustarla si hace falta.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {calcData?.metaConectado
                  ? 'No se pudo leer Meta — ingresa la inversión manualmente.'
                  : 'Este cliente no tiene cuenta de Meta vinculada (metaAdAccountId) — ingresa la inversión manualmente.'}
              </div>
            )}

            <div className="space-y-2">
              <Label>Inversión del cliente en pauta (COP)</Label>
              <Input
                type="number"
                placeholder="2000000"
                value={calcInversion}
                onChange={(e) => setCalcInversion(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comisión ({pctOf(calcSvc)}%)</span>
              <span className="text-xl font-semibold tabular-nums text-violet-400">
                {formatCurrency(comisionNum)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcOpen(false)}>Cerrar</Button>
            <Button onClick={generarCuentaComision} disabled={comisionNum <= 0} className="gap-1.5">
              Generar cuenta de cobro →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
