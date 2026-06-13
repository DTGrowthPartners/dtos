import { MonitorSmartphone } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function Webs() {
  return (
    <ComingSoon
      title="Webs"
      description="Sitios web por cliente y su mantenimiento anual."
      icon={MonitorSmartphone}
      iconClasses="text-sky-500 bg-sky-500/10"
      bullets={[
        'Tabla: web · cliente · plataforma (Shopify, WordPress, landing)',
        'Cobro anual de mantenimiento · quién paga',
        'Fecha de renovación con alerta si quedan menos de 30 días',
        'Estado del servicio de hosting/mantenimiento',
      ]}
    />
  );
}
