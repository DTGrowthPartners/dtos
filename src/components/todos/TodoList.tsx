import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListTodo, Plus, CheckCircle2, Circle, Trash2, Loader2, Send } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { loadTodos, createTodo, updateTodo, deleteTodo, type Todo } from '@/lib/firestoreTodoService';
import { createTask, loadProjects } from '@/lib/firestoreTaskService';
import { TEAM_MEMBERS, type TeamMemberName, type Task } from '@/types/taskTypes';

/**
 * Lista To-Do rápida y personal (por usuario). Pensada para usarse embebida
 * (p. ej. dentro de un popup en Operaciones) para pendientes muy pequeños.
 */
export default function TodoList() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Cuando la lista llena la pantalla (99vh) ya no se pueden agregar más pendientes.
  const [atLimit, setAtLimit] = useState(false);
  // Ventana activa real (la flotante PiP si aplica) para que confirm() salga ahí.
  const activeWindow = (): Window => containerRef.current?.ownerDocument?.defaultView ?? window;

  // El límite se alcanza cuando el contenido de la lista supera su alto visible
  // (que está topado a ~99vh): a partir de ahí desborda/scrollea => no se agrega más.
  const measureLimit = useCallback(() => {
    const el = listRef.current;
    setAtLimit(!!el && el.scrollHeight > el.clientHeight + 4);
  }, []);
  // Convertir pendiente -> tarea real
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [convertTodo, setConvertTodo] = useState<Todo | null>(null);
  const [convForm, setConvForm] = useState({ title: '', assignee: 'Stiven' as TeamMemberName, projectId: '', priority: 'MEDIUM', dueDate: '' });
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    loadProjects().then((p) => setProjects((p || []) as { id: string; name: string }[])).catch(() => {});
  }, []);

  const myName = (): TeamMemberName =>
    (TEAM_MEMBERS.find((m) => m.name === user?.firstName)?.name as TeamMemberName) || 'Stiven';

  const openConvert = (todo: Todo) => {
    setConvForm({ title: todo.text, assignee: myName(), projectId: '', priority: 'MEDIUM', dueDate: '' });
    setConvertTodo(todo);
  };

  const submitConvert = async () => {
    if (!convertTodo || !convForm.title.trim() || converting) return;
    setConverting(true);
    try {
      await createTask({
        title: convForm.title.trim(),
        description: '',
        status: 'TODO',
        priority: convForm.priority as Task['priority'],
        assignee: convForm.assignee,
        creator: myName(),
        projectId: convForm.projectId,
        dueDate: convForm.dueDate ? new Date(convForm.dueDate + 'T12:00:00').getTime() : undefined,
      } as Omit<Task, 'id' | 'createdAt'>);
      const id = convertTodo.id;
      setTodos((prev) => prev.filter((t) => t.id !== id));
      deleteTodo(id).catch(() => {});
      setConvertTodo(null);
      toast({ title: 'Convertido en tarea', description: 'El pendiente ahora es una tarea en Operaciones.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la tarea', variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setTodos(await loadTodos(user.id));
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los pendientes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  // Recalcular el límite cuando cambian los pendientes o el tamaño de la ventana.
  useEffect(() => { measureLimit(); }, [todos, loading, measureLimit]);
  useEffect(() => {
    const el = listRef.current;
    const win = activeWindow();
    if (!el) return;
    const ro = new ResizeObserver(() => measureLimit());
    ro.observe(el);
    win.addEventListener('resize', measureLimit);
    return () => { ro.disconnect(); win.removeEventListener('resize', measureLimit); };
  }, [todos.length, loading, measureLimit]);

  const pendientes = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const eo = (t: Todo) => t.order ?? t.createdAt; // orden efectivo
  const sortTodos = (arr: Todo[]) =>
    [...arr].sort((a, b) => (a.done === b.done ? eo(b) - eo(a) : a.done ? 1 : -1));

  // Reordenar arrastrando: recalcula el `order` del ítem movido entre sus vecinos.
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const list = [...todos];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const above = list[to - 1];
    const below = list[to + 1];
    let newOrder: number;
    if (!above) newOrder = (below ? eo(below) : Date.now()) + 1000;
    else if (!below) newOrder = eo(above) - 1000;
    else newOrder = (eo(above) + eo(below)) / 2;
    const updated = { ...moved, order: newOrder };
    list[to] = updated;
    setTodos(list);
    updateTodo(moved.id, { order: newOrder }).catch(() => load());
  };

  const add = async () => {
    const t = text.trim();
    if (!t || !user || adding || atLimit) return;
    setAdding(true);
    const tempId = `temp-${Date.now()}`;
    setTodos((prev) => [{ id: tempId, text: t, done: false, userId: user.id, createdAt: Date.now() }, ...prev]);
    setText('');
    inputRef.current?.focus(); // dejar el cursor listo para el siguiente pendiente
    try {
      const id = await createTodo(user.id, t);
      setTodos((prev) => prev.map((x) => (x.id === tempId ? { ...x, id } : x)));
    } catch {
      setTodos((prev) => prev.filter((x) => x.id !== tempId));
      toast({ title: 'Error', description: 'No se pudo agregar', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (todo: Todo) => {
    const done = !todo.done;
    setTodos((prev) => sortTodos(prev.map((x) => (x.id === todo.id ? { ...x, done, completedAt: done ? Date.now() : null } : x))));
    try { await updateTodo(todo.id, { done, completedAt: done ? Date.now() : null }); } catch { load(); }
  };

  const remove = async (todo: Todo) => {
    setTodos((prev) => prev.filter((x) => x.id !== todo.id));
    try { await deleteTodo(todo.id); } catch { load(); }
  };

  const clearDone = async () => {
    const done = todos.filter((t) => t.done);
    if (!done.length) return;
    setTodos((prev) => prev.filter((t) => !t.done));
    await Promise.all(done.map((t) => deleteTodo(t.id).catch(() => {})));
  };

  // --- Selección múltiple / eliminación masiva ---
  const allSelected = todos.length > 0 && selected.size === todos.length;
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const selectAll = () => setSelected(allSelected ? new Set() : new Set(todos.map((t) => t.id)));
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!activeWindow().confirm(`¿Eliminar ${ids.length} pendiente(s)?`)) return;
    setTodos((prev) => prev.filter((t) => !selected.has(t.id)));
    exitSelect();
    await Promise.all(ids.map((id) => deleteTodo(id).catch(() => {})));
  };

  const clearAll = async () => {
    if (!todos.length) return;
    if (!activeWindow().confirm(`¿Eliminar TODOS los ${todos.length} pendientes? No se puede deshacer.`)) return;
    const ids = todos.map((t) => t.id);
    setTodos([]);
    await Promise.all(ids.map((id) => deleteTodo(id).catch(() => {})));
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {selectMode ? (
          <>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} onChange={selectAll} className="h-4 w-4 accent-amber-500" />
              Seleccionar todas ({selected.size})
            </label>
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={!selected.size} onClick={deleteSelected}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar ({selected.size})
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exitSelect}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {pendientes > 0 ? `${pendientes} sin terminar` : 'Sin pendientes'}
            </p>
            <div className="flex items-center gap-1">
              {todos.some((t) => t.done) && (
                <Button variant="ghost" size="sm" onClick={clearDone} className="h-7 text-xs text-muted-foreground">
                  Limpiar completadas
                </Button>
              )}
              {todos.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)} className="h-7 text-xs text-muted-foreground">
                  Seleccionar
                </Button>
              )}
              {todos.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 text-xs text-red-500 hover:text-red-600"
                  title="Eliminar todas"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={atLimit ? 'Pantalla llena — completa o elimina pendientes' : 'Agregar un pendiente y Enter…'}
          disabled={atLimit}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={!text.trim() || adding || atLimit}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>
      {atLimit && (
        <p className="text-xs text-amber-600 dark:text-amber-400 -mt-1">
          Llegaste al límite de la pantalla (99vh). Completa o elimina pendientes para agregar más.
        </p>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando…</div>
      ) : todos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <ListTodo className="h-9 w-9 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin pendientes. Agrega el primero arriba 👆</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="todos-list">
            {(dropProvided) => (
              <div
                ref={(el) => { dropProvided.innerRef(el); listRef.current = el; }}
                {...dropProvided.droppableProps}
                className="rounded-xl border border-border bg-card divide-y divide-border overflow-y-auto"
                style={{ maxHeight: 'calc(99vh - 130px)' }}
              >
                {todos.map((todo, index) => (
                  <Draggable key={todo.id} draggableId={todo.id} index={index} isDragDisabled={selectMode}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...(!selectMode ? dragProvided.dragHandleProps : {})}
                        onClick={selectMode ? () => toggleSelect(todo.id) : undefined}
                        className={cn(
                          'group flex items-center gap-2 px-3 py-2.5 bg-card',
                          selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                          selectMode && selected.has(todo.id) && 'bg-amber-50 dark:bg-amber-950/30',
                          snapshot.isDragging && 'shadow-lg rounded-md ring-1 ring-amber-400'
                        )}
                      >
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selected.has(todo.id)}
                            readOnly
                            className="flex-shrink-0 h-4 w-4 accent-amber-500 pointer-events-none"
                          />
                        )}
                        {!selectMode && (
                          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => toggle(todo)} className="flex-shrink-0" title={todo.done ? 'Marcar pendiente' : 'Completar'}>
                            {todo.done ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                            )}
                          </button>
                        )}
                        <span className={cn('flex-1 text-sm break-words', todo.done && 'line-through text-muted-foreground')}>
                          {todo.text}
                        </span>
                        {!selectMode && (
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => openConvert(todo)}
                            className="flex-shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-primary transition-colors"
                            title="Convertir en tarea"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {!selectMode && (
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => remove(todo)}
                            className="flex-shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Convertir pendiente -> tarea real (Operaciones) */}
      <Dialog open={!!convertTodo} onOpenChange={(o) => !o && setConvertTodo(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Convertir en tarea</DialogTitle>
            <DialogDescription>Crea una tarea en Operaciones a partir de este pendiente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={convForm.title} onChange={(e) => setConvForm({ ...convForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Responsable</Label>
                <Select value={convForm.assignee} onValueChange={(v) => setConvForm({ ...convForm, assignee: v as TeamMemberName })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEAM_MEMBERS.map((m) => (<SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridad</Label>
                <Select value={convForm.priority} onValueChange={(v) => setConvForm({ ...convForm, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="LOW">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Proyecto</Label>
                <Select value={convForm.projectId || 'none'} onValueChange={(v) => setConvForm({ ...convForm, projectId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proyecto</SelectItem>
                    {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de entrega</Label>
                <Input type="date" value={convForm.dueDate} onChange={(e) => setConvForm({ ...convForm, dueDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTodo(null)} disabled={converting}>Cancelar</Button>
            <Button onClick={submitConvert} disabled={converting || !convForm.title.trim()}>
              {converting ? 'Creando…' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
