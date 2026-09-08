import { useState, useEffect } from 'react';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Grid3X3,
  List,
  Circle,
  Edit,
  Copy,
  Trash2,
  MessageCircle,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createTask,
  sendHighPriorityTaskToWhatsApp,
  loadTasks,
  loadProjects,
  updateTask,
  moveTaskToDeleted,
  copyTaskToCompleted,
} from '@/lib/firestoreTaskService';
import {
  type Task,
  type Project,
  TaskStatus,
  Priority,
  teamMemberStyle,
  DEFAULT_COLUMNS,
  DEFAULT_PROJECTS,
  type TeamMemberName,
} from '@/types/taskTypes';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { matchTeamMember } from '@/types/taskTypes';
import { useAuthStore } from '@/lib/auth';
import { TODO_DRAG_TYPE, TASK_DRAG_TYPE } from '@/components/todos/TodoList';
import { cn } from '@/lib/utils';
import ImageModal from '@/components/ImageModal';
import CommentsModal from '@/components/CommentsModal';
import { useNavigate } from 'react-router-dom';

const STATUS_MAP = {
  TODO: { label: 'Pendiente', icon: Clock, color: 'text-blue-500 bg-blue-100' },
  IN_PROGRESS: { label: 'En Progreso', icon: AlertCircle, color: 'text-yellow-500 bg-yellow-100' },
  DONE: { label: 'Completado', icon: CheckCircle2, color: 'text-green-500 bg-green-100' },
};

const PRIORITY_MAP = {
  LOW: { label: 'Baja', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MEDIUM: { label: 'Media', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  HIGH: { label: 'Alta', color: 'bg-red-100 text-red-800 border-red-300' },
};

const COLUMNS = [
  { status: 'TODO', name: 'Pendiente', color: 'text-blue-400' },
  { status: 'IN_PROGRESS', name: 'En Progreso', color: 'text-amber-400' },
  { status: 'DONE', name: 'Completadas', color: 'text-emerald-400' },
];


// Las tres secciones de la vista. El texto vacio invita a arrastrar.
const SECCIONES = [
  { status: TaskStatus.TODO, label: 'Pendiente', vacio: 'Nada pendiente. Arrastra un pendiente del To-Do aqui para volverlo tarea.' },
  { status: TaskStatus.IN_PROGRESS, label: 'En progreso', vacio: 'Arrastra aqui lo que estes haciendo.' },
  { status: TaskStatus.DONE, label: 'Completado', vacio: 'Todavia nada completado.' },
];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default function MisTareas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Arranca en el usuario logueado. Antes estaba fijo en 'Edgardo', así que
  // todo el mundo entraba viendo las tareas de él.
  const [userName, setUserName] = useState<TeamMemberName>('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const teamMembers = useTeamMembers();

  // Crear tarea desde aqui: va a la misma coleccion que Operaciones, asi que
  // aparece en el tablero al instante. Antes tocaba salir a Operaciones para
  // anotar cualquier pendiente propio.
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  // Si trae id, el dialogo esta editando esa tarea; si no, creando una nueva
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [responsableOriginal, setResponsableOriginal] = useState<string>('');
  // Seccion sobre la que se esta arrastrando algo (resalta la zona)
  const [dropZone, setDropZone] = useState<string | null>(null);
  const [nueva, setNueva] = useState({
    title: '',
    description: '',
    projectId: '',
    assignee: '' as TeamMemberName,
    priority: Priority.MEDIUM as Priority,
    status: TaskStatus.TODO as string,
    dueDate: '',
  });
  const { user } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Image and Comments modals
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, projectsData] = await Promise.all([
        loadTasks(),
        loadProjects(),
      ]);
      setTasks(tasksData);
      setProjects(projectsData.length > 0 ? projectsData : DEFAULT_PROJECTS);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las tareas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userName) return;
    setUserName(matchTeamMember(teamMembers, user?.firstName, user?.email) || user?.firstName || 'Edgardo');
  }, [teamMembers, user?.firstName, user?.email, userName]);

  const abrirNueva = () => {
    setEditandoId(null);
    setNueva({
      title: '',
      description: '',
      projectId: projects[0]?.id || '',
      assignee: userName,
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: '',
    });
    setNuevaAbierta(true);
  };

  const abrirEdicion = (task: Task) => {
    setEditandoId(task.id);
    setResponsableOriginal(task.assignee || '');
    setNueva({
      title: task.title || '',
      description: task.description || '',
      projectId: task.projectId || projects[0]?.id || '',
      assignee: task.assignee || userName,
      priority: (task.priority as Priority) || Priority.MEDIUM,
      status: task.status || TaskStatus.TODO,
      // El input date necesita la fecha local, no la UTC de toISOString()
      dueDate: task.dueDate
        ? (() => { const d = new Date(task.dueDate); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()
        : '',
    });
    setNuevaAbierta(true);
  };

  const crearTarea = async () => {
    if (!nueva.title.trim()) return;
    setGuardandoNueva(true);
    // Fecha local a mediodia: con la medianoche, el desfase de UTC la corria al dia anterior
    const vence = nueva.dueDate ? new Date(`${nueva.dueDate}T12:00:00`).getTime() : undefined;
    const responsable = nueva.assignee || userName;
    const proyecto = projects.find((p) => p.id === nueva.projectId);
    // Lo que se manda por WhatsApp al responsable (el backend resuelve su numero)
    const aviso = {
      titulo: nueva.title.trim(),
      descripcion: nueva.description.trim(),
      prioridad: nueva.priority === Priority.HIGH ? 'Alta' : nueva.priority === Priority.LOW ? 'Baja' : 'Media',
      asignado: responsable,
      proyecto: proyecto?.name || 'Sin proyecto',
      fechaLimite: nueva.dueDate || null,
    };
    try {
      if (editandoId) {
        await updateTask(editandoId, {
          title: nueva.title.trim(),
          description: nueva.description.trim(),
          status: nueva.status,
          priority: nueva.priority,
          assignee: responsable,
          projectId: nueva.projectId,
          dueDate: vence,
        });
        // Solo se avisa si cambio de manos: corregir un titulo no debe sonar el celular
        if (responsable !== responsableOriginal) {
          const original = tasks.find((t) => t.id === editandoId);
          sendHighPriorityTaskToWhatsApp({ ...aviso, id: editandoId, creador: original?.creator || userName, evento: 'actualizada' }).catch(() => {});
        }
        toast({ title: 'Tarea actualizada' });
      } else {
        const nuevoId = await createTask({
          title: nueva.title.trim(),
          description: nueva.description.trim(),
          status: nueva.status,
          priority: nueva.priority,
          assignee: responsable,
          creator: userName,
          projectId: nueva.projectId,
          dueDate: vence,
        } as Omit<Task, 'id' | 'createdAt'>);
        sendHighPriorityTaskToWhatsApp({ ...aviso, id: nuevoId, creador: userName, evento: 'creada' }).catch(() => {});
        toast({
          title: 'Tarea creada',
          description: nueva.assignee && nueva.assignee !== userName
            ? `Queda asignada a ${nueva.assignee} y ya aparece en Operaciones.`
            : 'Ya aparece en Operaciones.',
        });
      }
      setNuevaAbierta(false);
      await fetchData();
    } catch (e) {
      toast({ title: 'Error', description: `No se pudo ${editandoId ? 'actualizar' : 'crear'} la tarea`, variant: 'destructive' });
    } finally {
      setGuardandoNueva(false);
    }
  };

  const getProject = (projectId: string) => {
    return projects.find((p) => p.id === projectId);
  };

  const getTeamMember = (name: string) => {
    return teamMemberStyle(name);
  };

  // Mismo orden que el tablero de Tareas: position (orden arrastrado) y, para
  // tareas sin position, vencidas primero → fecha más próxima → prioridad.
  // Antes salían en orden crudo de Firestore (más reciente primero = "al revés").
  const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const STATUS_ORDER: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
  const compareTasks = (a: Task, b: Task) => {
    const aPos = (a as any).position;
    const bPos = (b as any).position;
    if (typeof aPos === 'number' && typeof bPos === 'number') return aPos - bPos;
    if (typeof aPos === 'number') return -1;
    if (typeof bPos === 'number') return 1;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const ts = hoy.getTime();
    const aVencida = !!(a.dueDate && a.dueDate < ts);
    const bVencida = !!(b.dueDate && b.dueDate < ts);
    if (aVencida !== bVencida) return aVencida ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
  };

  // Filter tasks by selected user (en la vista simple, pendientes antes que completadas)
  const userTasks = tasks
    .filter((task) => task.assignee === userName)
    .sort((a, b) => {
      const s = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
      return s !== 0 ? s : compareTasks(a, b);
    });

  const getTasksByStatus = (status: string) => {
    return userTasks.filter((task) => task.status === status).sort(compareTasks);
  };

  const resumen = [
    plural(getTasksByStatus(TaskStatus.TODO).length, 'pendiente', 'pendientes'),
    plural(getTasksByStatus(TaskStatus.IN_PROGRESS).length, 'en progreso', 'en progreso'),
    plural(getTasksByStatus(TaskStatus.DONE).length, 'completada', 'completadas'),
  ].join(' \u00b7 ');

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('taskId', task.id);
    // Para soltarla en el To-Do: solo viaja el titulo
    e.dataTransfer.setData(TASK_DRAG_TYPE, JSON.stringify({ id: task.id, title: task.title }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // El pendiente se copia (queda la tarea), la tarea se mueve de columna
    const esPendiente = e.dataTransfer.types.includes(TODO_DRAG_TYPE);
    e.dataTransfer.dropEffect = esPendiente ? 'copy' : 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();

    // Un pendiente del To-Do arrastrado hasta una columna se convierte en tarea
    const crudo = e.dataTransfer.getData(TODO_DRAG_TYPE);
    if (crudo) {
      try {
        const pendiente = JSON.parse(crudo) as { id: string; text: string };
        await createTask({
          title: pendiente.text,
          description: '',
          status: newStatus,
          priority: Priority.MEDIUM,
          assignee: userName,
          creator: userName,
          projectId: projects[0]?.id || '',
        } as Omit<Task, 'id' | 'createdAt'>);
        // El To-Do escucha esto y saca el pendiente de su lista
        window.dispatchEvent(new CustomEvent('dtos:todo-convertido', { detail: { id: pendiente.id } }));
        toast({ title: 'Convertido en tarea', description: pendiente.text });
        await fetchData();
      } catch {
        toast({ title: 'Error', description: 'No se pudo convertir el pendiente', variant: 'destructive' });
      }
      return;
    }

    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);

    if (taskId && draggedTask && task) {
      try {
        const updateData: Partial<Task> = { status: newStatus };
        if (newStatus === TaskStatus.DONE) {
          updateData.completedAt = Date.now();
          await copyTaskToCompleted(taskId, { ...task, status: newStatus });
        }
        await updateTask(taskId, updateData);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          )
        );
        toast({
          title: 'Tarea actualizada',
          description: 'El estado de la tarea se actualizó correctamente',
        });
      } catch (error) {
        console.error('Error updating task:', error);
        toast({
          title: 'Error',
          description: 'No se pudo actualizar la tarea',
          variant: 'destructive',
        });
      }
    }
    setDraggedTask(null);
  };

  const handleToggleComplete = async (task: Task) => {
    const previousStatus = task.status;
    const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;

    // Optimistic update - update UI immediately
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, completedAt: newStatus === TaskStatus.DONE ? Date.now() : undefined }
          : t
      )
    );

    try {
      if (previousStatus === TaskStatus.DONE) {
        await updateTask(task.id, { status: TaskStatus.TODO });
      } else {
        await updateTask(task.id, { status: TaskStatus.DONE, completedAt: Date.now() });
        await copyTaskToCompleted(task.id, { ...task, status: TaskStatus.DONE });
      }
      // No need to fetchData() - we already updated the UI optimistically
    } catch (error) {
      console.error('Error toggling complete:', error);
      // Revert optimistic update on error
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id ? { ...t, status: previousStatus } : t
        )
      );
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;

    try {
      await moveTaskToDeleted(task.id, task);
      toast({
        title: 'Tarea eliminada',
        description: 'La tarea se movió a la papelera',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la tarea',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = (task: Task) => {
    setSelectedTaskForComments(task);
    setCommentsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando tareas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Tareas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{resumen}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={userName} onValueChange={(v) => setUserName(v as TeamMemberName)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => (
                <SelectItem key={member.name} value={member.name}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${member.color}`}></div>
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={abrirNueva} className="h-9 gap-1.5">
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        </div>
      </div>

      {/* Tasks Content: tres secciones por estado. Cada una recibe arrastres:
          un pendiente del To-Do se vuelve tarea ahi, una tarea cambia de estado. */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl space-y-8 pb-10">
          {SECCIONES.map((sec) => {
            const items = getTasksByStatus(sec.status);
            const activa = dropZone === sec.status;
            return (
              <section
                key={sec.status}
                onDragOver={(e) => { handleDragOver(e); if (dropZone !== sec.status) setDropZone(sec.status); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropZone(null); }}
                onDrop={(e) => { setDropZone(null); handleDrop(e, sec.status); }}
                className={cn('rounded-lg -mx-2 px-2 transition-colors', activa && 'bg-primary/5 ring-1 ring-primary/30')}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</h2>
                  <span className="text-[11px] tabular-nums text-muted-foreground/60">{items.length}</span>
                </div>

                {items.length === 0 ? (
                  <div className={cn(
                    'rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground/60',
                    activa ? 'border-primary/40 text-primary/70' : 'border-border/60'
                  )}>
                    {sec.vacio}
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {items.map((task) => {
                      const project = getProject(task.projectId);
                      const hecha = task.status === TaskStatus.DONE;
                      const vencida = !hecha && !!task.dueDate && task.dueDate < Date.now() - 86_400_000;
                      const nComentarios = task.comments?.length || 0;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={() => setDraggedTask(null)}
                          className={cn(
                            'group flex items-start gap-3 py-3 cursor-grab active:cursor-grabbing',
                            draggedTask === task.id && 'opacity-40'
                          )}
                        >
                          <button
                            onClick={() => handleToggleComplete(task)}
                            aria-label={hecha ? 'Marcar pendiente' : 'Completar'}
                            className={cn(
                              'mt-[3px] h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
                              hecha
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-muted-foreground/50 hover:border-emerald-500'
                            )}
                          >
                            {hecha && <CheckCircle2 className="h-3 w-3" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className={cn('text-[15px] leading-snug', hecha && 'line-through text-muted-foreground')}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                              {project && (
                                <span className="flex items-center gap-1.5">
                                  <span className={cn('h-2 w-2 rounded-full', project.color)} />
                                  {project.name}
                                </span>
                              )}
                              {task.priority === Priority.HIGH && !hecha && (
                                <span className="text-red-500 font-medium">Alta</span>
                              )}
                              {task.dueDate && (
                                <span className={cn('flex items-center gap-1', vencida && 'text-red-500')}>
                                  <Calendar className="h-3 w-3" />
                                  {new Date(task.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {task.creator && task.creator !== task.assignee && (
                                <span title="Quien la asigno">de {task.creator}</span>
                              )}
                              {nComentarios > 0 && (
                                <button onClick={() => handleAddComment(task)} className="flex items-center gap-1 hover:text-foreground">
                                  <MessageCircle className="h-3 w-3" /> {nComentarios}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Acciones: solo al pasar el mouse en pantalla grande; siempre en tactil */}
                          <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => abrirEdicion(task)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Comentar" onClick={() => handleAddComment(task)}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Eliminar" onClick={() => handleDelete(task)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <p className="text-xs text-muted-foreground/60 px-1">
            Arrastra un pendiente del To-Do a una seccion para volverlo tarea, o una tarea al To-Do para anotarla como pendiente.
            {' '}
            <button onClick={() => navigate('/tareas')} className="underline underline-offset-2 hover:text-foreground">Ver Operaciones</button>
          </p>
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => {
          setImageModalOpen(false);
          setSelectedImage('');
        }}
        imageSrc={selectedImage}
        alt="Task image"
      />

      {/* Comments Modal */}
      <CommentsModal
        isOpen={commentsModalOpen}
        onClose={() => {
          setCommentsModalOpen(false);
          setSelectedTaskForComments(null);
        }}
        task={selectedTaskForComments}
        onSaveComment={async () => {
          // Refresh data after comment
          fetchData();
        }}
      />

      {/* Nueva tarea: misma coleccion que Operaciones */}
      <Dialog open={nuevaAbierta} onOpenChange={setNuevaAbierta}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
            <DialogDescription>
              {editandoId ? 'Los cambios se ven igual en Operaciones.' : 'Queda tambien en Operaciones.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>¿Qué hay que hacer? *</Label>
              <Input
                autoFocus
                value={nueva.title}
                onChange={(e) => setNueva({ ...nueva, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && nueva.title.trim()) crearTarea(); }}
                placeholder="Ej. Enviar propuesta a Tennis Cartagena"
              />
            </div>
            <div className="space-y-2">
              <Label>Detalles</Label>
              <Textarea
                value={nueva.description}
                onChange={(e) => setNueva({ ...nueva, description: e.target.value })}
                placeholder="Opcional"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proyecto</Label>
                <Select value={nueva.projectId} onValueChange={(v) => setNueva({ ...nueva, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegir proyecto" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={nueva.assignee} onValueChange={(v) => setNueva({ ...nueva, assignee: v as TeamMemberName })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                          {m.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={nueva.priority} onValueChange={(v) => setNueva({ ...nueva, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Priority.LOW}>Baja</SelectItem>
                    <SelectItem value={Priority.MEDIUM}>Media</SelectItem>
                    <SelectItem value={Priority.HIGH}>Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha límite</Label>
                <Input
                  type="date"
                  value={nueva.dueDate}
                  onChange={(e) => setNueva({ ...nueva, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={nueva.status} onValueChange={(v) => setNueva({ ...nueva, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TaskStatus.TODO}>Pendiente</SelectItem>
                    <SelectItem value={TaskStatus.IN_PROGRESS}>En Progreso</SelectItem>
                    <SelectItem value={TaskStatus.DONE}>Completado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaAbierta(false)}>Cancelar</Button>
            <Button onClick={crearTarea} disabled={guardandoNueva || !nueva.title.trim()}>
              {guardandoNueva ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
