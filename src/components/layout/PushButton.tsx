import { useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { enablePush, pushPermission } from '@/lib/push';

const REASONS: Record<string, string> = {
  'no-soportado': 'Tu navegador no soporta notificaciones push.',
  'permiso-denegado': 'Permiso denegado. Actívalo desde los ajustes del navegador.',
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
      if (!granted) {
        const r = await enablePush();
        if (r.ok) {
          setGranted(true);
          toast({ title: 'Notificaciones activadas', description: 'Recibirás avisos del DTOS en este dispositivo.' });
        } else {
          toast({ title: 'No se pudo activar', description: REASONS[r.reason || ''] || r.reason, variant: 'destructive' });
        }
      } else {
        // Ya activadas: re-registra el token y manda una de prueba.
        await enablePush();
        await apiClient.post('/api/push/test', {});
        toast({ title: 'Notificación de prueba enviada', description: 'Debería llegarte en un momento.' });
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
