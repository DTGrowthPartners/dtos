import { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { enablePush, pushPermission } from '@/lib/push';

const REASONS: Record<string, string> = {
  'no-instalada': 'Abre el DTOS desde el ÍCONO instalado en la pantalla de inicio (no desde Safari) y vuelve a intentar.',
  'no-soportado': 'Tu navegador/dispositivo no soporta notificaciones push.',
  'no-soportado-fcm': 'FCM no es compatible aquí (posible iOS). Avísame para usar push nativo.',
  'permiso-denegado': 'Permiso denegado. Actívalo en Ajustes → Notificaciones.',
  'sin-token': 'No se pudo obtener el token de notificaciones.',
  'sin-vapid': 'Falta configurar la clave VAPID.',
};

export default function PushButton({ isMisTareasView }: { isMisTareasView?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(pushPermission() === 'granted');

  const handleClick = async () => {
    setLoading(true);
    try {
      // Siempre (re)registra el token — pide permiso si falta. Evita quedar en
      // "permiso concedido pero sin token registrado".
      const r = await enablePush();
      if (!r.ok) {
        const msg = REASONS[r.reason || ''] || r.reason || 'Error desconocido';
        toast({ title: 'No se pudo activar', description: msg, variant: 'destructive' });
        // Alert visible en móvil (para diagnosticar): muestra el motivo exacto.
        try { alert('🔔 No se activó: ' + (r.reason || '') + '\n' + msg); } catch { /* noop */ }
        return;
      }
      setGranted(true);
      // Manda una de prueba para confirmar que llega.
      await apiClient.post('/api/push/test', {});
      toast({ title: 'Notificaciones activas ✅', description: 'Te enviamos una de prueba; debería llegarte en un momento.' });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={loading}
      title={granted ? 'Notificaciones activas (clic para probar)' : 'Activar notificaciones push'}
      className={isMisTareasView ? 'text-slate-400 hover:text-slate-200' : 'text-muted-foreground hover:text-foreground'}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : granted ? (
        <BellRing className="h-5 w-5 text-emerald-500" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
    </Button>
  );
}
