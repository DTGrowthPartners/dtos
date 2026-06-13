import { Globe } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function Dominios() {
  return (
    <ComingSoon
      title="Dominios"
      description="Control de dominios y su vencimiento por cliente."
      icon={Globe}
      iconClasses="text-cyan-500 bg-cyan-500/10"
      bullets={[
        'Tabla: dominio · cliente · plataforma · fecha de vencimiento',
        'Días restantes con alerta si quedan menos de 30 días',
        'Valor de renovación anual · quién paga (DTGP o cliente)',
        'Estado de renovación: vigente / por vencer / vencido',
      ]}
    />
  );
}
