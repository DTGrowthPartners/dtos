import { useState, useEffect } from 'react';
import { Plus, Briefcase, Calendar, DollarSign, Edit, Trash2, Clock, AlertCircle } from 'lucide-react';
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
  frecuencia: string;
  fechaInicio: string;
  fechaProximoCobro?: string;
  fechaVencimiento?: string;
  estado: string;
  notas?: string;
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
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Pago Unico' },
];

const ESTADOS = [
  { value: 'activo', label: 'Activo', color: 'bg-green-100 text-green-800' },
  { value: 'pausado', label: 'Pausado', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
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

  const [formData, setFormData] = useState({
    serviceId: '',
    precioCliente: '',
    frecuencia: 'mensual',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaProximoCobro: '',
    fechaVencimiento: '',
    notas: '',
  });

  const { toast } = useToast();

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
      const payload = {
        serviceId: formData.serviceId,
        precioCliente: formData.precioCliente ? parseFloat(formData.precioCliente) : undefined,
        frecuencia: formData.frecuencia,
        fechaInicio: formData.fechaInicio,
        fechaProximoCobro: formData.fechaProximoCobro || undefined,
        fechaVencimiento: formData.fechaVencimiento || undefined,
        notas: formData.notas || undefined,
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
      frecuencia: cs.frecuencia,
      fechaInicio: cs.fechaInicio.split('T')[0],
      fechaProximoCobro: cs.fechaProximoCobro?.split('T')[0] || '',
      fechaVencimiento: cs.fechaVencimiento?.split('T')[0] || '',
      notas: cs.notas || '',
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
      frecuencia: 'mensual',
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaProximoCobro: '',
      fechaVencimiento: '',
      notas: '',
    });
    setEditingService(null);
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS.find(e => e.value === estado) || ESTADOS[0];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const selectedService = availableServices.find(s => s.id === formData.serviceId);
  const assignedServiceIds = clientServices.map(cs => cs.serviceId);
  const unassignedServices = availableServices.filter(s => !assignedServiceIds.includes(s.id));

  // Calcular totales
  const totalMensual = clientServices
    .filter(cs => cs.estado === 'activo')
    .reduce((sum, cs) => {
      const precio = cs.precioCliente ?? cs.service.price;
      switch (cs.frecuencia) {
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
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} disabled={unassignedServices.length === 0}>
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
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(precio, cs.service.currency)}</span>
                          {cs.precioCliente && (
                            <span className="text-xs line-through text-muted-foreground/50">
                              {formatCurrency(cs.service.price)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{FRECUENCIAS.find(f => f.value === cs.frecuencia)?.label}</span>
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
              {/* Selector de servicio */}
              <div className="space-y-2">
                <Label>Servicio *</Label>
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
              </div>

              {/* Precio personalizado */}
              <div className="space-y-2">
                <Label>Precio para este cliente</Label>
                <Input
                  type="number"
                  placeholder={selectedService ? `Default: ${selectedService.price}` : 'Precio'}
                  value={formData.precioCliente}
                  onChange={(e) => setFormData({ ...formData, precioCliente: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Dejar vacio para usar el precio estandar del servicio</p>
              </div>

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
              <Button type="submit" disabled={isLoading || !formData.serviceId}>
                {isLoading ? 'Guardando...' : editingService ? 'Actualizar' : 'Agregar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
