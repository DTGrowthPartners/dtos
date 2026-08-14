import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Smile, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/** Badge NPS de la ficha del cliente: último puntaje de la cuenta y su
 *  tendencia vs el trimestre anterior (spec NPS de Dairo, punto 6).
 *  No renderiza nada si la cuenta aún no tiene respuestas. */

interface NpsCliente {
  tiene: boolean;
  trimestre?: string;
  promedio?: number;
  clase?: 'promotor' | 'pasivo' | 'detractor';
  anterior?: { trimestre: string; promedio: number } | null;
}

const CLASE_STYLE: Record<string, string> = {
  promotor: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  pasivo: 'border-amber-300 bg-amber-50 text-amber-700',
  detractor: 'border-red-300 bg-red-50 text-red-700',
};

const ClientNpsBadge = ({ clientId }: { clientId: string }) => {
  const [nps, setNps] = useState<NpsCliente | null>(null);

  useEffect(() => {
    let vivo = true;
    apiClient.get<NpsCliente>(`/api/nps/cliente/${clientId}`)
      .then((r) => { if (vivo) setNps(r); })
      .catch(() => { if (vivo) setNps(null); });
    return () => { vivo = false; };
  }, [clientId]);

  if (!nps?.tiene) return null;

  const diff = nps.anterior ? Math.round(((nps.promedio || 0) - nps.anterior.promedio) * 10) / 10 : null;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-semibold', CLASE_STYLE[nps.clase || 'pasivo'])}
      title={`NPS ${nps.trimestre}: ${nps.promedio}/10 (${nps.clase})${nps.anterior ? ` · ${nps.anterior.trimestre}: ${nps.anterior.promedio}` : ''}`}
    >
      <Smile className="h-3.5 w-3.5" />
      NPS {nps.promedio}
      {diff !== null && (diff > 0
        ? <span className="inline-flex items-center text-emerald-600"><TrendingUp className="h-3 w-3" />+{diff}</span>
        : diff < 0
          ? <span className="inline-flex items-center text-red-600"><TrendingDown className="h-3 w-3" />{diff}</span>
          : <Minus className="h-3 w-3 opacity-60" />)}
    </Badge>
  );
};

export default ClientNpsBadge;
