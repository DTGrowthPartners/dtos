import { useEffect, useMemo, useState } from 'react';
import { ListTodo, Plus, CheckCircle2, Circle, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { loadTodos, createTodo, updateTodo, deleteTodo, type Todo } from '@/lib/firestoreTodoService';

export default function Todos() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

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

  const pendientes = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

  const add = async () => {
    const t = text.trim();
    if (!t || !user || adding) return;
    setAdding(true);
    // optimista
    const tempId = `temp-${Date.now()}`;
    setTodos((prev) => [{ id: tempId, text: t, done: false, userId: user.id, createdAt: Date.now() }, ...prev]);
    setText('');
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
    setTodos((prev) =>
      [...prev.map((x) => (x.id === todo.id ? { ...x, done, completedAt: done ? Date.now() : null } : x))]
        .sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1))
    );
    try {
      await updateTodo(todo.id, { done, completedAt: done ? Date.now() : null });
    } catch { load(); }
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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
          <ListTodo className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">To-Do</h1>
          <p className="text-sm text-muted-foreground">
            Lista rápida para pendientes pequeños. {pendientes > 0 && `${pendientes} sin terminar.`}
          </p>
        </div>
        {todos.some((t) => t.done) && (
          <Button variant="ghost" size="sm" onClick={clearDone} className="text-muted-foreground">
            Limpiar completadas
          </Button>
        )}
      </div>

      {/* Agregar */}
      <form
        onSubmit={(e) => { e.preventDefault(); add(); }}
        className="flex gap-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Agregar un pendiente y Enter…"
          autoFocus
          disabled={adding}
        />
        <Button type="submit" disabled={!text.trim() || adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : todos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <ListTodo className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin pendientes. Agrega el primero arriba 👆</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {todos.map((todo) => (
            <div key={todo.id} className="group flex items-center gap-3 px-3 py-2.5">
              <button onClick={() => toggle(todo)} className="flex-shrink-0" title={todo.done ? 'Marcar pendiente' : 'Completar'}>
                {todo.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </button>
              <span className={cn('flex-1 text-sm break-words', todo.done && 'line-through text-muted-foreground')}>
                {todo.text}
              </span>
              <button
                onClick={() => remove(todo)}
                className="flex-shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
