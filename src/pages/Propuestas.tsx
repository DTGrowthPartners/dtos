import { FileText } from 'lucide-react';
import ComingSoon from '@/components/ComingSoon';

export default function Propuestas() {
  return (
    <ComingSoon
      title="Propuestas"
      description="Genera y trackea propuestas comerciales para prospectos."
      icon={FileText}
      iconClasses="text-emerald-500 bg-emerald-500/10"
      bullets={[
        'Lista de propuestas: cliente · servicio · valor · fecha de envío',
        'Estado: borrador / enviada / en revisión / ganada / perdida',
        'Botón "Nueva" abre Claude con el skill de propuestas',
        'No guarda el PDF — guarda el registro y el estado',
      ]}
    />
  );
}
