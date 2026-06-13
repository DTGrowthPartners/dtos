import { useRef, useState, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface MicButtonProps {
  /** Recibe el texto transcrito. */
  onTranscribed: (text: string) => void;
  /** Tamaño del botón. */
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  title?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result = "data:audio/webm;base64,XXXX" -> quitar el prefijo
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Botón de microfono: graba audio (MediaRecorder), lo envia a /api/transcribe
 * (Whisper) y devuelve el texto via onTranscribed. Reutilizable en cualquier
 * input/textarea.
 */
export default function MicButton({ onTranscribed, size = 'md', className, disabled, title }: MicButtonProps) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: 'No disponible', description: 'Tu navegador no soporta grabación de audio.', variant: 'destructive' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      // Elegir un mime soportado
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 1000) {
          toast({ title: 'Audio muy corto', description: 'Mantén presionado un momento e intenta de nuevo.' });
          return;
        }
        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const res = await apiClient.post<{ success: boolean; text?: string; error?: string }>(
            '/api/transcribe',
            { audio: base64, mimeType: mr.mimeType || 'audio/webm' }
          );
          if (!res.success || !res.text) throw new Error(res.error || 'Sin transcripción');
          onTranscribed(res.text);
        } catch (e) {
          toast({
            title: 'Error al transcribir',
            description: e instanceof Error ? e.message : 'Intenta de nuevo',
            variant: 'destructive',
          });
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      toast({
        title: 'Micrófono no disponible',
        description: 'Permite el acceso al micrófono en el navegador.',
        variant: 'destructive',
      });
    }
  }, [onTranscribed, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const toggle = () => {
    if (transcribing) return;
    if (recording) stopRecording();
    else startRecording();
  };

  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-4 w-4';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || transcribing}
      title={title || (recording ? 'Detener y transcribir' : 'Grabar audio')}
      className={cn(
        'inline-flex items-center justify-center rounded-md border transition-colors flex-shrink-0',
        dim,
        recording
          ? 'border-red-500/50 bg-red-500/15 text-red-600 animate-pulse'
          : 'border-border bg-background text-muted-foreground hover:text-violet-600 hover:border-violet-500/40 hover:bg-violet-500/10',
        (disabled || transcribing) && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      {transcribing ? (
        <Loader2 className={cn(icon, 'animate-spin')} />
      ) : recording ? (
        <Square className={cn(icon, 'fill-current')} />
      ) : (
        <Mic className={icon} />
      )}
    </button>
  );
}
