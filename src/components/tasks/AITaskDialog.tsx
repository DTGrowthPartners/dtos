import { useState } from 'react';
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

export interface ParsedTask {
  title: string;
  description: string;
  assignee: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  type: string | null;
}

interface AITaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed: (parsed: ParsedTask, originalText: string) => void;
}

const EXAMPLES = [
  'Mañana a las 3 PM revisar con Dairo el reporte de Meta Ads del lunes, es urgente. Asignar a Stiven.',
  'Necesitamos diseñar el banner del evento de Yeison Jiménez para este sábado. Lía, prioridad alta.',
  'Editar video del corte de cuentas de mayo, asignar a Anderson para fin de semana.',
];

export default function AITaskDialog({ open, onOpenChange, onParsed }: AITaskDialogProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInterpret = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ title: 'Escribe primero', description: 'Necesito un párrafo describiendo la tarea.' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data?: ParsedTask; error?: string }>(
        '/api/tasks-ai/parse',
        { text: trimmed }
      );
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Sin respuesta');
      }
      if (!res.data.title) {
        toast({
          title: 'No pude inferir un título claro',
          description: 'Intenta con más contexto: qué hay que hacer, para cuándo y quién.',
          variant: 'destructive',
        });
        return;
      }
      onParsed(res.data, trimmed);
      setText('');
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo interpretar el texto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleInterpret();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (loading) return;
        if (!o) setText('');
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Crear tarea con IA
          </DialogTitle>
          <DialogDescription>
            Describe la tarea en lenguaje natural. La IA extraerá título, responsable, prioridad y fecha límite. Luego puedes revisar todo antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Textarea
            placeholder="Ej: Mañana a las 3 PM revisar con Dairo el reporte de Meta Ads. Es urgente. Asignar a Stiven."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[140px] resize-y"
            maxLength={2000}
            autoFocus
            disabled={loading}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">Ctrl+Enter</kbd> para interpretar
            </span>
            <span className={text.length > 1800 ? 'text-amber-500' : ''}>{text.length}/2000</span>
          </div>

          {/* Ejemplos clickeables */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
              <Lightbulb className="h-3 w-3" />
              <span className="font-medium uppercase tracking-wider">Ejemplos</span>
            </div>
            <div className="space-y-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(ex)}
                  disabled={loading}
                  className="block text-left text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  → {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleInterpret}
            disabled={loading || !text.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Interpretando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Interpretar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
