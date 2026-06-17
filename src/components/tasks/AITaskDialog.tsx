import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, Lightbulb, ListChecks, Check, ChevronLeft, Calendar, Mic } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import MicButton from '@/components/MicButton';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  loadProjects,
  loadTasks,
  createTask,
  getNextPositionForStatus,
} from '@/lib/firestoreTaskService';
import { TaskStatus, Priority, TEAM_MEMBERS, type Project, type TeamMemberName, type TaskType } from '@/types/taskTypes';

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

interface ListItem extends ParsedTask {
  include: boolean;
}

const EXAMPLES = [
  'Mañana a las 3 PM revisar con Dairo el reporte de Meta Ads del lunes, es urgente. Asignar a Stiven.',
  'Lista (pega varias líneas):\n- enviar cuenta cobro Fabio\n- propuesta agentes equilibrio\n- reunión Jhonatan\n- subir campañas caribe fest',
];

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'border-red-500/40 bg-red-500/10 text-red-600',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  LOW: 'border-slate-500/40 bg-slate-500/10 text-slate-500',
};

// Cuenta lineas no vacias (quitando bullets/checkboxes). >=2 => es una lista.
const countListLines = (text: string): number => {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•·]?\s*(\[.?\]\s*)?/, '').trim())
    .filter((l) => l.length > 0).length;
};

const toTimestamp = (dueDate: string | null, dueTime: string | null): number | undefined => {
  if (!dueDate) return undefined;
  const t = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '09:00';
  const ts = new Date(`${dueDate}T${t}:00`).getTime();
  return Number.isNaN(ts) ? undefined : ts;
};

const mapPriority = (p: string): Priority =>
  p === 'HIGH' ? Priority.HIGH : p === 'LOW' ? Priority.LOW : Priority.MEDIUM;

export default function AITaskDialog({ open, onOpenChange, onParsed }: AITaskDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Modo lista
  const [mode, setMode] = useState<'input' | 'review'>('input');
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  // Responsable global para el modo lista. 'AUTO' = respeta lo que infirió la IA por tarea.
  const [bulkAssignee, setBulkAssignee] = useState<string>('AUTO');
  const [creating, setCreating] = useState(false);

  const resetAll = () => {
    setText('');
    setMode('input');
    setListItems([]);
    setProjectId('');
    setBulkAssignee('AUTO');
  };

  const defaultAssignee = (): TeamMemberName => {
    const name = user?.firstName || '';
    const hit = TEAM_MEMBERS.find((m) => m.name.toLowerCase() === name.toLowerCase());
    return (hit?.name as TeamMemberName) || ('Stiven' as TeamMemberName);
  };

  const handleInterpret = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ title: 'Escribe primero', description: 'Necesito un párrafo o una lista de tareas.' });
      return;
    }
    setLoading(true);
    try {
      const isList = countListLines(trimmed) >= 2;
      if (isList) {
        // --- Modo lista: varias tareas ---
        const res = await apiClient.post<{ success: boolean; tasks?: ParsedTask[]; error?: string }>(
          '/api/tasks-ai/parse-list',
          { text: trimmed }
        );
        if (!res.success || !res.tasks || res.tasks.length === 0) {
          throw new Error(res.error || 'No pude extraer tareas de la lista');
        }
        const projs = await loadProjects().catch(() => [] as Project[]);
        setProjects(projs);
        setProjectId(projs[0]?.id || '');
        setListItems(res.tasks.map((t) => ({ ...t, include: true })));
        setMode('review');
      } else {
        // --- Modo single: una tarea (prefill del form) ---
        const res = await apiClient.post<{ success: boolean; data?: ParsedTask; error?: string }>(
          '/api/tasks-ai/parse',
          { text: trimmed }
        );
        if (!res.success || !res.data) throw new Error(res.error || 'Sin respuesta');
        if (!res.data.title) {
          toast({
            title: 'No pude inferir un título claro',
            description: 'Intenta con más contexto: qué hay que hacer, para cuándo y quién.',
            variant: 'destructive',
          });
          return;
        }
        onParsed(res.data, trimmed);
        resetAll();
        onOpenChange(false);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo interpretar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createBulk = async () => {
    const included = listItems.filter((t) => t.include);
    if (included.length === 0) {
      toast({ title: 'Selecciona al menos una tarea' });
      return;
    }
    setCreating(true);
    try {
      // Base de position al final de la columna TODO
      const allTasks = await loadTasks().catch(() => []);
      let basePos = getNextPositionForStatus(allTasks, TaskStatus.TODO);
      const creator = defaultAssignee();

      for (const t of included) {
        await createTask({
          title: t.title,
          description: t.description || '',
          status: TaskStatus.TODO,
          priority: mapPriority(t.priority),
          assignee:
            bulkAssignee !== 'AUTO'
              ? (bulkAssignee as TeamMemberName)
              : (t.assignee as TeamMemberName) || defaultAssignee(),
          creator,
          projectId: projectId || '',
          type: (t.type as TaskType) || undefined,
          dueDate: toTimestamp(t.dueDate, t.dueTime),
          position: basePos++,
        } as Parameters<typeof createTask>[0]);
      }

      // Avisar a la vista Tareas (si esta montada) que recargue
      window.dispatchEvent(new Event('dtos:tasks-changed'));
      toast({
        title: `✓ ${included.length} tarea${included.length > 1 ? 's' : ''} creada${included.length > 1 ? 's' : ''}`,
        description: 'Revísalas y delégalas en Operaciones.',
      });
      resetAll();
      onOpenChange(false);
      navigate('/tareas');
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudieron crear las tareas',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleInterpret();
    }
  };

  const includedCount = listItems.filter((t) => t.include).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (loading || creating) return;
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        {mode === 'input' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                Crear tarea con IA
              </DialogTitle>
              <DialogDescription>
                Describe una tarea o <strong>pega una lista</strong> (varias líneas / bullets). La IA las reescribe claras y accionables, infiere responsable, prioridad y fecha. Revisas antes de guardar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="relative">
                <Textarea
                  placeholder={'Una tarea: "Mañana 3 PM revisar reporte con Dairo, urgente, asignar a Stiven."\n\nO pega/dicta una lista:\n- enviar cuenta cobro Fabio\n- propuesta agentes equilibrio\n- reunión Jhonatan'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[160px] resize-y pr-12"
                  maxLength={4000}
                  autoFocus
                  disabled={loading}
                />
                {/* Mic: dicta y se agrega al texto */}
                <div className="absolute top-2 right-2">
                  <MicButton
                    disabled={loading}
                    title="Dictar (voz a texto)"
                    onTranscribed={(t) =>
                      setText((prev) => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' + t : t))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono text-[10px]">Ctrl+Enter</kbd> para interpretar
                  <span className="mx-1.5">·</span>
                  <Mic className="h-3 w-3 inline -mt-0.5" /> dicta con el micrófono
                  {countListLines(text) >= 2 && (
                    <span className="ml-2 text-violet-500">· {countListLines(text)} tareas detectadas</span>
                  )}
                </span>
                <span className={text.length > 3600 ? 'text-amber-500' : ''}>{text.length}/4000</span>
              </div>

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
                      className="block text-left text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 whitespace-pre-line"
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-violet-500" />
                {listItems.length} tareas interpretadas
              </DialogTitle>
              <DialogDescription>
                Elige el proyecto, revisa las tareas (desmarca las que no quieras) y créalas. Caen en <strong>Tarea</strong> para que las ordenes y delegues.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Proyecto + Responsable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Proyecto</label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proyecto…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                      {projects.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay proyectos. Créalas sin proyecto.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
                  <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">Auto (según IA)</SelectItem>
                      {TEAM_MEMBERS.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name} · {m.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lista */}
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                {listItems.map((t, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() =>
                      setListItems((prev) => prev.map((x, i) => (i === idx ? { ...x, include: !x.include } : x)))
                    }
                    className={cn(
                      'w-full text-left flex items-start gap-2 rounded-md p-2 transition-colors',
                      t.include ? 'hover:bg-muted/50' : 'opacity-40 hover:opacity-70'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-4 w-4 items-center justify-center rounded border flex-shrink-0',
                        t.include ? 'bg-violet-600 border-violet-600 text-white' : 'border-muted-foreground/40'
                      )}
                    >
                      {t.include && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">{t.title}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={cn('text-[9px]', PRIORITY_BADGE[t.priority])}>
                          {t.priority === 'HIGH' ? 'Alta' : t.priority === 'LOW' ? 'Baja' : 'Media'}
                        </Badge>
                        {(bulkAssignee !== 'AUTO' ? bulkAssignee : t.assignee) && (
                          <Badge variant="outline" className="text-[9px] border-blue-500/40 bg-blue-500/10 text-blue-600">
                            {bulkAssignee !== 'AUTO' ? bulkAssignee : t.assignee}
                          </Badge>
                        )}
                        {t.dueDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {t.dueDate}
                            {t.dueTime ? ` ${t.dueTime}` : ''}
                          </span>
                        )}
                        {t.type && <span className="text-[10px] text-muted-foreground">· {t.type}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setMode('input')} disabled={creating}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
              <Button
                onClick={createBulk}
                disabled={creating || includedCount === 0}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <ListChecks className="h-4 w-4 mr-2" />
                    Crear {includedCount} tarea{includedCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
