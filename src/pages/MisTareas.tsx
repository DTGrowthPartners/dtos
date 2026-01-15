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
import {
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
  TEAM_MEMBERS,
  DEFAULT_COLUMNS,
  DEFAULT_PROJECTS,
  type TeamMemberName,
} from '@/types/taskTypes';
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

type ViewMode = 'simple' | 'card' | 'list' | 'compact';

export default function MisTareas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<TeamMemberName>('Edgardo');
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
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

  const getProject = (projectId: string) => {
    return projects.find((p) => p.id === projectId);
  };

  const getTeamMember = (name: string) => {
    return TEAM_MEMBERS.find((m) => m.name === name);
  };

  // Filter tasks by selected user
  const userTasks = tasks.filter((task) => task.assignee === userName);

  const getTasksByStatus = (status: string) => {
    return userTasks.filter((task) => task.status === status);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
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

  const getViewModeLabel = () => {
    switch (viewMode) {
      case 'simple':
        return 'Simple';
      case 'card':
        return 'Tarjetas';
      case 'list':
        return 'Lista';
      case 'compact':
        return 'Compacta';
    }
  };

  const cycleViewMode = () => {
    const modes: ViewMode[] = ['simple', 'card', 'list', 'compact'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mis Tareas</h1>
            <p className="text-muted-foreground">
              Tareas asignadas a ti en el sistema
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={userName} onValueChange={(v) => setUserName(v as TeamMemberName)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_MEMBERS.map((member) => (
                    <SelectItem key={member.name} value={member.name}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${member.color}`}></div>
                        {member.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={cycleViewMode}>
              {['simple', 'card'].includes(viewMode) ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
              Vista: {getViewModeLabel()}
            </Button>
            <Button onClick={() => navigate('/tareas')}>
              <Plus className="h-4 w-4 mr-2" />
              Gestionar Tareas
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(STATUS_MAP).map(([status, config]) => {
            const count = getTasksByStatus(status).length;
            const Icon = config.icon;
            return (
              <div key={status} className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'simple' ? (
          /* Vista Simple */
          <div className="h-full overflow-y-auto">
            <div className="space-y-2 max-w-3xl">
              {userTasks.length === 0 ? (
                <div className="rounded-lg border bg-card p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No tienes tareas asignadas</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/tareas')}>
                    Ir a Gestión de Tareas
                  </Button>
                </div>
              ) : (
                userTasks.map((task) => {
                  const status = STATUS_MAP[task.status as keyof typeof STATUS_MAP];
                  const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];
                  const project = getProject(task.projectId);
                  const StatusIcon = status?.icon || Clock;

                  return (
                    <div key={task.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-2">
                            <button
                              onClick={() => handleToggleComplete(task)}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
                                task.status === TaskStatus.DONE
                                  ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                                  : 'border-muted-foreground hover:border-emerald-500 hover:scale-110'
                              }`}
                            >
                              {task.status === TaskStatus.DONE && <CheckCircle2 className="h-3 w-3 animate-in zoom-in duration-200" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-medium transition-all duration-300 ${task.status === TaskStatus.DONE ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </h3>
                              {task.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 ml-8">
                            {project && (
                              <span className={`text-xs px-2 py-1 rounded-full ${project.color} text-white`}>
                                {project.name}
                              </span>
                            )}
                            {priority && (
                              <span className={`text-xs px-2 py-1 rounded-full ${priority.color}`}>
                                {priority.label}
                              </span>
                            )}
                            {task.type && (
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                {task.type}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${status?.color || 'bg-gray-100'}`}>
                              {status?.label || task.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleAddComment(task)}
                          >
                            <MessageCircle className="h-4 w-4" />
                            {task.comments && task.comments.length > 0 && (
                              <span className="text-xs ml-0.5">{task.comments.length}</span>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(task)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Vista Kanban (Card, List, Compact) */
          <div className="h-full overflow-x-auto">
            <div className="flex gap-4 h-full min-w-max pb-4">
              {COLUMNS.map((column) => {
                const columnTasks = getTasksByStatus(column.status);
                const StatusIcon = STATUS_MAP[column.status as keyof typeof STATUS_MAP]?.icon || Circle;

                return (
                  <div
                    key={column.status}
                    className="flex-1 min-w-[320px] flex flex-col bg-muted/50 rounded-lg p-4"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.status)}
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-4">
                      <StatusIcon className={`h-5 w-5 ${column.color}`} />
                      <h2 className="font-semibold text-lg">
                        {column.name}
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({columnTasks.length})
                        </span>
                      </h2>
                    </div>

                    {/* Tasks */}
                    <div className={`space-y-3 flex-1 overflow-y-auto ${viewMode === 'compact' ? 'space-y-1' : ''}`}>
                      {columnTasks.length === 0 ? (
                        <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                          Sin tareas
                        </div>
                      ) : (
                        columnTasks.map((task) => {
                          const project = getProject(task.projectId);
                          const assignee = getTeamMember(task.assignee);
                          const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];

                          if (viewMode === 'compact') {
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className={`p-2 bg-card rounded border-l-4 cursor-move hover:shadow transition-all ${
                                  draggedTask === task.id ? 'opacity-50' : ''
                                }`}
                                style={{ borderLeftColor: project?.color.replace('bg-', '#').replace('-500', '') || '#3b82f6' }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${priority?.color.split(' ')[0] || 'bg-gray-300'}`}></span>
                                  <span className="text-sm flex-1 truncate">{task.title}</span>
                                  {task.dueDate && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(task.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (viewMode === 'list') {
                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className={`p-3 bg-card rounded-lg border cursor-move hover:shadow transition-all ${
                                  draggedTask === task.id ? 'opacity-50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(task);
                                    }}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      task.status === TaskStatus.DONE
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-muted-foreground'
                                    }`}
                                  >
                                    {task.status === TaskStatus.DONE && <CheckCircle2 className="h-3 w-3" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${task.status === TaskStatus.DONE ? 'line-through text-muted-foreground' : ''}`}>
                                      {task.title}
                                    </p>
                                    {project && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${project.color} text-white`}>
                                        {project.name}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${priority?.color || 'bg-gray-100'}`}>
                                    {priority?.label || task.priority}
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          // Card View
                          return (
                            <Card
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className={`p-4 cursor-move hover:shadow-lg transition-all ${
                                draggedTask === task.id ? 'opacity-50' : ''
                              }`}
                              style={{
                                borderLeftWidth: '4px',
                                borderLeftColor: project?.color.replace('bg-', '#').replace('-500', '') || '#3b82f6',
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(task);
                                    }}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
                                      task.status === TaskStatus.DONE
                                        ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                                        : 'border-muted-foreground hover:border-emerald-500 hover:scale-110'
                                    }`}
                                  >
                                    {task.status === TaskStatus.DONE && <CheckCircle2 className="h-3 w-3 animate-in zoom-in duration-200" />}
                                  </button>
                                  <h3 className={`font-semibold text-sm transition-all duration-300 ${task.status === TaskStatus.DONE ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </h3>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(task);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              {task.description && (
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-1 mb-2">
                                {project && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${project.color} text-white`}>
                                    {project.name}
                                  </span>
                                )}
                                {task.type && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                    {task.type}
                                  </span>
                                )}
                              </div>

                              {task.images && task.images.length > 0 && (
                                <div className="flex gap-1 mb-2 flex-wrap">
                                  {task.images.slice(0, 3).map((img, idx) => (
                                    <img
                                      key={idx}
                                      src={img}
                                      alt={`Image ${idx + 1}`}
                                      className="w-10 h-10 object-cover rounded border cursor-pointer hover:scale-110 transition-transform"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedImage(img);
                                        setImageModalOpen(true);
                                      }}
                                    />
                                  ))}
                                  {task.images.length > 3 && (
                                    <div className="w-10 h-10 bg-muted border rounded flex items-center justify-center text-xs">
                                      +{task.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="flex gap-2 items-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${priority?.color || 'bg-gray-100'}`}>
                                    {priority?.label || task.priority}
                                  </span>
                                  {task.dueDate && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(task.dueDate).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: 'short',
                                      })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 items-center">
                                  {task.images && task.images.length > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <ImageIcon className="h-3 w-3" />
                                      {task.images.length}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddComment(task);
                                    }}
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                    {task.comments && task.comments.length > 0 && (
                                      <span className="text-[10px] ml-0.5">{task.comments.length}</span>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
    </div>
  );
}
