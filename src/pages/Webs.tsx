import { useMemo } from 'react';
import { MonitorSmartphone, ExternalLink, Settings } from 'lucide-react';
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
  domainStatus,
  type WebPlatform,
} from '@/data/domains';

const PLATFORM_ORDER: WebPlatform[] = ['react', 'shopify', 'wordpress', 'inactivo'];

export default function Webs() {
  const { activas, inactivas, porPlataforma } = useMemo(() => {
    const activas = DOMAINS.filter((d) => d.platform !== 'inactivo');
    const inactivas = DOMAINS.filter((d) => d.platform === 'inactivo');
    const porPlataforma = PLATFORM_ORDER.filter((p) => p !== 'inactivo').map((p) => ({
      platform: p,
      count: DOMAINS.filter((d) => d.platform === p).length,
    }));
    return { activas, inactivas, porPlataforma };
  }, []);

  const renderCard = (d: (typeof DOMAINS)[number]) => {
    const status = domainStatus(d);
    const isActive = d.platform !== 'inactivo';
    return (
      <Card key={d.domain} className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{d.domain}</p>
            <p className="text-xs text-muted-foreground">{REGISTRAR_LABEL[d.registrar]}</p>
          </div>
          <Badge variant="outline" className={cn('text-xs flex-shrink-0', PLATFORM_BADGE[d.platform])}>
            {PLATFORM_LABEL[d.platform]}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mt-auto pt-1">
          {isActive ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => window.open(`https://${d.domain}`, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Visitar
            </Button>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground italic">Sitio inactivo</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(REGISTRAR_URL[d.registrar], '_blank', 'noopener,noreferrer')}
            title={`Administrar dominio en ${REGISTRAR_LABEL[d.registrar]}`}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
        {status === 'por-vencer' && <p className="text-xs text-amber-500">Dominio próximo a vencer</p>}
        {status === 'vencido' && <p className="text-xs text-red-500">Dominio vencido</p>}
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
          <MonitorSmartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Webs</h1>
          <p className="text-sm text-muted-foreground">
            Sitios web del portafolio y su plataforma. La gestión del dominio está en Dominios.
          </p>
        </div>
      </div>

      {/* Resumen por plataforma */}
      <div className="flex flex-wrap gap-2">
        {porPlataforma.map(({ platform, count }) => (
          <Badge key={platform} variant="outline" className={cn('text-xs', PLATFORM_BADGE[platform])}>
            {PLATFORM_LABEL[platform]}: {count}
          </Badge>
        ))}
      </div>

      {/* Activas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Activas ({activas.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{activas.map(renderCard)}</div>
      </div>

      {/* Inactivas */}
      {inactivas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Inactivas ({inactivas.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{inactivas.map(renderCard)}</div>
        </div>
      )}
    </div>
  );
}
