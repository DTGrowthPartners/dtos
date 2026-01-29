import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ServiceStatus {
  id: string;
  name: string;
  status: string;
  progress: number;
  startDate: string;
  endDate: string | null;
  deliverables: string | null;
  notes: string | null;
}

interface Deliverable {
  name: string;
  completed: boolean;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'active':
      return {
        label: 'Activo',
        color: 'bg-green-500/10 text-green-600 border-green-200',
        icon: Play,
        iconColor: 'text-green-600',
      };
    case 'paused':
      return {
        label: 'Pausado',
        color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
        icon: Pause,
        iconColor: 'text-yellow-600',
      };
    case 'pending':
      return {
        label: 'Pendiente',
        color: 'bg-orange-500/10 text-orange-600 border-orange-200',
        icon: Clock,
        iconColor: 'text-orange-600',
      };
    case 'completed':
      return {
        label: 'Completado',
        color: 'bg-blue-500/10 text-blue-600 border-blue-200',
        icon: CheckCircle2,
        iconColor: 'text-blue-600',
      };
    default:
      return {
        label: status,
        color: 'bg-gray-500/10 text-gray-600 border-gray-200',
        icon: Briefcase,
        iconColor: 'text-gray-600',
      };
  }
};

const parseDeliverables = (deliverables: string | null): Deliverable[] => {
  if (!deliverables) return [];
  try {
    return JSON.parse(deliverables);
  } catch {
    return [];
  }
};

export default function ClientServices() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<ServiceStatus[]>(
          '/api/client-portal/portal/services'
        );
        setServices(response);
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Error al cargar los servicios');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // Group services by status
  const activeServices = services.filter((s) => s.status === 'active');
  const pendingServices = services.filter((s) => s.status === 'pending');
  const completedServices = services.filter((s) => s.status === 'completed');
  const pausedServices = services.filter((s) => s.status === 'paused');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const ServiceCard = ({ service }: { service: ServiceStatus }) => {
    const statusConfig = getStatusConfig(service.status);
    const StatusIcon = statusConfig.icon;
    const deliverables = parseDeliverables(service.deliverables);
    const completedDeliverables = deliverables.filter((d) => d.completed).length;

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                service.status === 'active' ? 'bg-green-500/10' :
                service.status === 'completed' ? 'bg-blue-500/10' :
                service.status === 'paused' ? 'bg-yellow-500/10' :
                'bg-orange-500/10'
              }`}>
                <StatusIcon className={`h-5 w-5 ${statusConfig.iconColor}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{service.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Inicio: {new Date(service.startDate).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{service.progress}%</span>
            </div>
            <Progress value={service.progress} className="h-2" />
          </div>

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">
                Entregables ({completedDeliverables}/{deliverables.length})
              </p>
              <div className="space-y-2">
                {deliverables.map((deliverable, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 text-sm ${
                      deliverable.completed ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      deliverable.completed
                        ? 'bg-green-500 border-green-500'
                        : 'border-muted-foreground'
                    }`}>
                      {deliverable.completed && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span>{deliverable.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {service.notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">{service.notes}</p>
            </div>
          )}

          {/* End Date */}
          {service.endDate && (
            <div className="mt-4 text-sm text-muted-foreground">
              Fecha estimada de fin: {new Date(service.endDate).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Servicios</h1>
        <p className="text-muted-foreground">Estado de los servicios contratados</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold">{activeServices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{pendingServices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold">{completedServices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Pause className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pausados</p>
                <p className="text-2xl font-bold">{pausedServices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay servicios registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Services */}
          {activeServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Play className="h-5 w-5 text-green-600" />
                Servicios Activos
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeServices.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          )}

          {/* Pending Services */}
          {pendingServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Servicios Pendientes
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingServices.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          )}

          {/* Paused Services */}
          {pausedServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Pause className="h-5 w-5 text-yellow-600" />
                Servicios Pausados
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pausedServices.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Services */}
          {completedServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                Servicios Completados
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {completedServices.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
