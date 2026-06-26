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
      const wasGranted = pushPermission() === 'granted';
      // Siempre (re)registra/refresca el token — pide permiso si falta.
      const r = await enablePush();
      if (!r.ok) {
        const msg = REASONS[r.reason || ''] || r.reason || 'Error desconocido';
        toast({ title: 'No se pudo activar', description: msg, variant: 'destructive' });
        try { alert('🔔 No se activó: ' + (r.reason || '') + '\n' + msg); } catch { /* noop */ }
        return;
      }
      setGranted(true);
      if (!wasGranted) {
        // Primera activación: una sola notificación de bienvenida.
        await apiClient.post('/api/push/test', {});
        toast({ title: 'Notificaciones activadas ✅', description: 'Te llega un aviso de prueba; de ahí en adelante recibes las notificaciones reales (tareas, etc.).' });
      } else {
        // Ya estaban activas: solo confirmar, sin reenviar la de prueba.
        toast({ title: 'Notificaciones activas', description: 'Ya estás recibiendo notificaciones en este dispositivo.' });
      }
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
