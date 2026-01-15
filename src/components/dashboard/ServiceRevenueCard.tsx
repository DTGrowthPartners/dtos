import { useState, useEffect } from 'react';
import { Briefcase, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { Link } from 'react-router-dom';

interface ServiceBreakdown {
  serviceId: string;
  serviceName: string;
  clientCount: number;
  totalRevenue: number;
  avgPrice: number;
}

interface ServiceRevenueMetrics {
  totalMRR: number;
  totalARR: number;
  activeClientsWithServices: number;
  totalActiveServices: number;
  serviceBreakdown: ServiceBreakdown[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function ServiceRevenueCard() {
  const [metrics, setMetrics] = useState<ServiceRevenueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await apiClient.get<ServiceRevenueMetrics>('/api/services/metrics/revenue');
        setMetrics(data);
      } catch (error) {
        console.error('Error fetching service metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Recurrentes</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  const topServices = metrics.serviceBreakdown.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Ingresos por Servicios</CardTitle>
        <Briefcase className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* MRR Principal */}
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(metrics.totalMRR)}
              <span className="text-sm font-normal text-muted-foreground ml-1">/mes</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(metrics.totalARR)} anualizados
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{metrics.activeClientsWithServices} clientes</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span>{metrics.totalActiveServices} contratos</span>
            </div>
          </div>

          {/* Top Services */}
          {topServices.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Top Servicios</p>
              {topServices.map((service) => (
                <div key={service.serviceId} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{service.serviceName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {service.clientCount}
                    </Badge>
                    <span className="text-muted-foreground font-medium">
                      {formatCurrency(service.totalRevenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link to Services */}
          <Link to="/servicios">
            <Button variant="ghost" size="sm" className="w-full mt-2">
              Ver todos los servicios
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
