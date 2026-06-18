import { useMemo } from 'react';
import { Globe, ExternalLink, AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DOMAINS,
  REGISTRAR_URL,
  REGISTRAR_LABEL,
  PLATFORM_LABEL,
  PLATFORM_BADGE,
  daysUntil,
  domainStatus,
  formatDomainDate,
  formatCOP,
  type DomainStatus,
} from '@/data/domains';

const STATUS_BADGE: Record<DomainStatus, string> = {
  vencido: 'border-red-500/40 bg-red-500/10 text-red-500',
  'por-vencer': 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  vigente: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  inactivo: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

const STATUS_LABEL: Record<DomainStatus, string> = {
  vencido: 'Vencido',
  'por-vencer': 'Por vencer',
  vigente: 'Vigente',
  inactivo: 'Inactivo',
};

const daysLabel = (days: number): string => {
  if (days < 0) return `hace ${Math.abs(days)} d`;
  if (days === 0) return 'hoy';
  return `en ${days} d`;
};

export default function Dominios() {
  // Ordenados por proximidad de expiración (más próximo primero).
  const domains = useMemo(
    () => [...DOMAINS].sort((a, b) => +new Date(a.expiration) - +new Date(b.expiration)),
    []
  );

  const activos = domains.filter((d) => d.platform !== 'inactivo').length;
  const porVencer = domains.filter((d) => domainStatus(d) === 'por-vencer' || domainStatus(d) === 'vencido').length;
  const costoAnual = domains.reduce((sum, d) => sum + d.annualPrice, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
          <Globe className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dominios</h1>
          <p className="text-sm text-muted-foreground">
            Vencimiento y renovación de dominios. La renovación la paga el cliente.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Dominios</p>
          <p className="text-2xl font-bold">{domains.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Activos</p>
          <p className="text-2xl font-bold">{activos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Por vencer (≤30 d)
          </p>
          <p className="text-2xl font-bold">{porVencer}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Costo anual total
          </p>
          <p className="text-2xl font-bold">{formatCOP(costoAnual)}</p>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Dominio</th>
                <th className="px-4 py-3 font-medium">Plataforma</th>
                <th className="px-4 py-3 font-medium">Vence / Renueva</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Renovación anual</th>
                <th className="px-4 py-3 font-medium text-right">Administrar</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => {
                const status = domainStatus(d);
                const days = daysUntil(d.expiration);
                const isActive = d.platform !== 'inactivo';
                return (
                  <tr key={d.domain} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {isActive ? (
                        <a
                          href={`https://${d.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-primary inline-flex items-center gap-1"
                        >
                          {d.domain}
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </a>
                      ) : (
                        <span className="font-medium text-muted-foreground">{d.domain}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-xs', PLATFORM_BADGE[d.platform])}>
                        {PLATFORM_LABEL[d.platform]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{formatDomainDate(d.expiration)}</span>
                      </div>
                      {isActive && (
                        <span
                          className={cn(
                            'text-xs',
                            days < 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-muted-foreground'
                          )}
                        >
                          {daysLabel(days)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-xs', STATUS_BADGE[status])}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatCOP(d.annualPrice)}</div>
                      <div className="text-xs text-muted-foreground">
                        Paga: {d.paidBy === 'cliente' ? 'Cliente' : 'DTGP'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(REGISTRAR_URL[d.registrar], '_blank', 'noopener,noreferrer')}
                        title={`Administrar en ${REGISTRAR_LABEL[d.registrar]}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Administrar
                        <span className="ml-1.5 text-xs text-muted-foreground hidden sm:inline">
                          · {REGISTRAR_LABEL[d.registrar]}
                        </span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        * Precio de renovación es un valor de referencia (600.000 COP/año) hasta tener los costos reales por dominio.
      </p>
    </div>
  );
}
