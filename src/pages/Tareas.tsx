import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Upload,
  X,
  MessageCircle,
  Image as ImageIcon,
  Copy,
  Clock,
  CheckCircle2,
  Circle,
  Grid3X3,
  List,
  User,
  FolderOpen,
  Filter,
  LayoutGrid,
  Hash,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { convertImageToBase64, validateImage } from '@/lib/imageService';
import ImageModal from '@/components/ImageModal';
import CommentsModal from '@/components/CommentsModal';
import {
  loadTasks,
  createTask,
  updateTask,
  loadProjects,
  createProject,
  moveTaskToDeleted,
  copyTaskToCompleted,
  addTaskComment,
  importTasksFromExport,
} from '@/lib/firestoreTaskService';
import {
  type Task,
  type Project,
  type TaskComment,
  TaskStatus,
  Priority,
  TASK_TYPES,
  TEAM_MEMBERS,
  DEFAULT_COLUMNS,
  DEFAULT_PROJECTS,
  type TaskType,
  type TeamMemberName,
} from '@/types/taskTypes';
import { useAuthStore } from '@/lib/auth';

const PRIORITY_COLORS = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  HIGH: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_ICONS = {
  TODO: Circle,
  IN_PROGRESS: Clock,
  DONE: CheckCircle2,
};

type ViewMode = 'card' | 'list' | 'compact';

export default function Tareas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [duplicatingTask, setDuplicatingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuthStore();

  // Map user firstName to team member name (case-insensitive matching)
  const getTeamMemberNameFromUser = (firstName: string | undefined): TeamMemberName | undefined => {
    if (!firstName) return undefined;
    const normalizedName = firstName.toLowerCase().trim();
    const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === normalizedName);
    return member?.name;
  };

  const loggedUserName = getTeamMemberNameFromUser(user?.firstName);

  // Image and Comments modals
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null);

  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('bg-indigo-500');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    assignee: 'Stiven' as TeamMemberName,
    creator: 'Dairo' as TeamMemberName,
    projectId: '',
    type: '' as TaskType | '',
    dueDate: '',
    startDate: '',
    images: [] as string[],
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

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
      // Use loaded projects or default if none exist
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }
    if (!formData.projectId) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar un proyecto',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const taskData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.status,
      priority: formData.priority,
      assignee: formData.assignee,
      creator: formData.creator,
      projectId: formData.projectId,
      type: formData.type || undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate).getTime() : undefined,
      startDate: formData.startDate ? new Date(formData.startDate).getTime() : undefined,
      images: formData.images,
    };

    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);
        toast({
          title: 'Tarea actualizada',
          description: 'La tarea se actualizó correctamente',
        });
      } else {
        await createTask(taskData as Omit<Task, 'id' | 'createdAt'>);
        toast({
          title: duplicatingTask ? 'Tarea duplicada' : 'Tarea creada',
          description: duplicatingTask
            ? 'La tarea se duplicó correctamente'
            : 'La tarea se creó correctamente',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar la tarea',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del proyecto es requerido',
        variant: 'destructive',
      });
      return;
    }

    try {
      const projectId = await createProject({
        name: newProjectName.trim(),
        color: newProjectColor,
      });
      setProjects([...projects, { id: projectId, name: newProjectName.trim(), color: newProjectColor }]);
      setFormData({ ...formData, projectId });
      setIsProjectDialogOpen(false);
      setNewProjectName('');
      toast({
        title: 'Proyecto creado',
        description: 'El proyecto se creó correctamente',
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Error al crear el proyecto',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDuplicatingTask(null);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status as TaskStatus,
      priority: task.priority,
      assignee: task.assignee,
      creator: task.creator,
      projectId: task.projectId,
      type: task.type || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      images: task.images || [],
    });
    setIsDialogOpen(true);
  };

  const handleDuplicate = (task: Task) => {
    setEditingTask(null);
    setDuplicatingTask(task);
    setFormData({
      title: `${task.title} (Copia)`,
      description: task.description || '',
      status: TaskStatus.TODO,
      priority: task.priority,
      assignee: task.assignee,
      creator: task.creator,
      projectId: task.projectId,
      type: task.type || '',
      dueDate: '',
      startDate: '',
      images: task.images || [],
    });
    setIsDialogOpen(true);
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

  const handleToggleComplete = async (task: Task) => {
    try {
      if (task.status === TaskStatus.DONE) {
        // If already done, move back to TODO
        await updateTask(task.id, { status: TaskStatus.TODO });
      } else {
        // Mark as done and copy to completed tasks
        await updateTask(task.id, { status: TaskStatus.DONE, completedAt: Date.now() });
        await copyTaskToCompleted(task.id, { ...task, status: TaskStatus.DONE });
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling complete:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la tarea',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      assignee: loggedUserName || 'Stiven',
      creator: loggedUserName || 'Dairo',
      projectId: '',
      type: '',
      dueDate: '',
      startDate: '',
      images: [],
    });
    setEditingTask(null);
    setDuplicatingTask(null);
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

  // Image handlers
  const handleImageUpload = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.valid) {
      toast({
        title: 'Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    if (formData.images.length >= 5) {
      toast({
        title: 'Error',
        description: 'Máximo 5 imágenes por tarea',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const base64 = await convertImageToBase64(file);
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, base64],
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Error al procesar la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
        break;
      }
    }
  };

  // Comments handlers
  const handleAddComment = (task: Task) => {
    setSelectedTaskForComments(task);
    setCommentsModalOpen(true);
  };

  const handleSaveComment = async (taskId: string, comment: { text: string; author: string }) => {
    try {
      const newComment = {
        id: crypto.randomUUID(),
        text: comment.text,
        author: comment.author,
        createdAt: Date.now(),
      };

      await addTaskComment(taskId, newComment);

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, comments: [...(task.comments || []), newComment as TaskComment] }
            : task
        )
      );

      if (selectedTaskForComments && selectedTaskForComments.id === taskId) {
        setSelectedTaskForComments({
          ...selectedTaskForComments,
          comments: [...(selectedTaskForComments.comments || []), newComment as TaskComment],
        });
      }

      toast({
        title: 'Comentario agregado',
        description: 'El comentario se agregó correctamente',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el comentario',
        variant: 'destructive',
      });
    }
  };

  // Import tasks from JSON file
  const handleImportTasks = async (file: File) => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const exportData = JSON.parse(text);

      // Use first project as default or create one
      let defaultProjectId = projects.length > 0 ? projects[0].id : '';
      if (!defaultProjectId) {
        defaultProjectId = await createProject({ name: 'Importado', color: 'bg-slate-500' });
        setProjects([...projects, { id: defaultProjectId, name: 'Importado', color: 'bg-slate-500' }]);
      }

      const result = await importTasksFromExport(exportData, defaultProjectId);

      toast({
        title: 'Importación completada',
        description: `Se importaron ${result.imported} tareas. ${result.errors > 0 ? `${result.errors} errores.` : ''}`,
      });

      fetchData();
    } catch (error) {
      console.error('Error importing tasks:', error);
      toast({
        title: 'Error',
        description: 'No se pudo importar el archivo. Verifica que sea un JSON válido.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  const getProject = (projectId: string) => {
    return projects.find((p) => p.id === projectId);
  };

  const getTeamMember = (name: string) => {
    return TEAM_MEMBERS.find((m) => m.name === name);
  };

  // Debug: Log user info to console
  console.log('User:', user?.firstName, '-> Mapped to:', loggedUserName);

  // Filter tasks - only show tasks where user is creator or assignee
  const filteredTasks = tasks.filter((task) => {
    // First filter by logged user (must be creator or assignee)
    // If loggedUserName is undefined (no match found), show all tasks as fallback
    const isUserTask = loggedUserName
      ? (task.assignee === loggedUserName || task.creator === loggedUserName)
      : true; // If no match or no user logged, show all (fallback)

    if (!isUserTask) return false;

    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || task.projectId === filterProject;
    const matchesAssignee = filterAssignee === 'all' || task.assignee === filterAssignee;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    return matchesSearch && matchesProject && matchesAssignee && matchesPriority;
  });

  const getTasksByColumn = (status: string) => {
    return filteredTasks.filter((task) => task.status === status);
  };

  const cycleViewMode = () => {
    const modes: ViewMode[] = ['card', 'list', 'compact'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando tareas...</div>
      </div>
    );
  }

  // Helper to count tasks by project
  const getTaskCountByProject = (projectId: string) => {
    return tasks.filter(t => {
      const isUserTask = loggedUserName
        ? (t.assignee === loggedUserName || t.creator === loggedUserName)
        : true;
      return isUserTask && t.projectId === projectId;
    }).length;
  };

  return (
    <div className="animate-fade-in h-full flex gap-6">
      {/* Left Sidebar - Projects */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        {/* User Info */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full ${TEAM_MEMBERS.find(m => m.name === loggedUserName)?.color || 'bg-primary'} flex items-center justify-center text-white font-semibold`}>
              {TEAM_MEMBERS.find(m => m.name === loggedUserName)?.initials || user?.firstName?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-semibold">{loggedUserName || user?.firstName || 'Usuario'}</p>
              <p className="text-xs text-muted-foreground">{TEAM_MEMBERS.find(m => m.name === loggedUserName)?.role || 'Miembro'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950">
              <p className="text-lg font-bold text-blue-600">{getTasksByColumn('TODO').length}</p>
              <p className="text-[10px] text-muted-foreground">Pendiente</p>
            </div>
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950">
              <p className="text-lg font-bold text-amber-600">{getTasksByColumn('IN_PROGRESS').length}</p>
              <p className="text-[10px] text-muted-foreground">En curso</p>
            </div>
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950">
              <p className="text-lg font-bold text-emerald-600">{getTasksByColumn('DONE').length}</p>
              <p className="text-[10px] text-muted-foreground">Hecho</p>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="rounded-lg border bg-card p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Proyectos
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsProjectDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 overflow-y-auto flex-1">
            <button
              onClick={() => setFilterProject('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                filterProject === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>Todos</span>
              </div>
              <span className="text-xs opacity-70">{filteredTasks.length}</span>
            </button>
            {projects.map((project) => {
              const count = getTaskCountByProject(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => setFilterProject(project.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                    filterProject === project.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${project.color}`}></div>
                    <span className="truncate">{project.name}</span>
                  </div>
                  <span className="text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros rápidos
          </h3>
          <div className="space-y-2">
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-full h-9">
                <User className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Asignado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TEAM_MEMBERS.map((member) => (
                  <SelectItem key={member.name} value={member.name}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${member.color}`}></div>
                      {member.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full h-9">
                <Hash className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Media</SelectItem>
                <SelectItem value="LOW">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportTasks(file);
            }}
          />
          <Button
            className="w-full"
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => importFileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? 'Importando...' : 'Importar JSON'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mis Tareas</h1>
            <p className="text-sm text-muted-foreground">
              {filterProject !== 'all' ? projects.find(p => p.id === filterProject)?.name : 'Todos los proyectos'}
              {' · '}{filteredTasks.length} tareas
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button variant="outline" size="icon" onClick={cycleViewMode}>
              {viewMode === 'card' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full pb-4">
          {DEFAULT_COLUMNS.map((column) => {
            const columnTasks = getTasksByColumn(column.status);
            const StatusIcon = STATUS_ICONS[column.status as keyof typeof STATUS_ICONS] || Circle;

            return (
              <div
                key={column.id}
                className="w-[350px] flex-shrink-0 flex flex-col bg-muted/50 rounded-lg p-4"
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
                  {columnTasks.map((task) => {
                    const project = getProject(task.projectId);
                    const assignee = getTeamMember(task.assignee);

                    if (viewMode === 'compact') {
                      // Compact View
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
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority].split(' ')[0]}`}></span>
                            <span className="text-sm flex-1 truncate">{task.title}</span>
                            <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                              {assignee?.initials}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (viewMode === 'list') {
                      // List View
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
                            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                            </span>
                            <div className={`w-7 h-7 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                              {assignee?.initials}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(task)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(task)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Card View (default)
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
                        {/* Task Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleComplete(task);
                              }}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                task.status === TaskStatus.DONE
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-muted-foreground hover:border-emerald-500'
                              }`}
                            >
                              {task.status === TaskStatus.DONE && <CheckCircle2 className="h-3 w-3" />}
                            </button>
                            <h3 className={`font-semibold text-sm ${task.status === TaskStatus.DONE ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </h3>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(task);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(task);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
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
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Project & Type */}
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

                        {/* Images */}
                        {task.images && task.images.length > 0 && (
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {task.images.slice(0, 3).map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Image ${idx + 1}`}
                                className="w-12 h-12 object-cover rounded border cursor-pointer hover:scale-110 transition-transform"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedImage(img);
                                  setImageModalOpen(true);
                                }}
                              />
                            ))}
                            {task.images.length > 3 && (
                              <div className="w-12 h-12 bg-muted border rounded flex items-center justify-center text-xs">
                                +{task.images.length - 3}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex gap-2 items-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                PRIORITY_COLORS[task.priority]
                              }`}
                            >
                              {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Media' : 'Baja'}
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
                            <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                              {assignee?.initials}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  {columnTasks.length === 0 && (
                    <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                      Arrastra tareas aquí
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Editar Tarea' : duplicatingTask ? 'Duplicar Tarea' : 'Nueva Tarea'}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? 'Actualiza la información de la tarea'
                : duplicatingTask
                ? 'Crea una copia de la tarea'
                : 'Completa los datos de la nueva tarea'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Título de la tarea"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  disabled={isSaving}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción de la tarea (puedes pegar imágenes con Ctrl+V)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onPaste={handlePaste}
                  disabled={isSaving}
                  rows={3}
                />
              </div>

              {/* Project */}
              <div className="space-y-2">
                <Label>Proyecto *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona un proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${project.color}`}></div>
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Images Section */}
              <div className="space-y-2">
                <Label>Imágenes ({formData.images.length}/5)</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img}
                        alt={`Upload ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                        onClick={() => handleRemoveImage(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || formData.images.length >= 5}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Procesando...' : 'Subir Imagen'}
                </Button>
              </div>

              {/* Row 1: Status, Priority, Type */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TaskStatus.TODO}>Pendiente</SelectItem>
                      <SelectItem value={TaskStatus.IN_PROGRESS}>En Progreso</SelectItem>
                      <SelectItem value={TaskStatus.DONE}>Completado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value as Priority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Priority.LOW}>Baja</SelectItem>
                      <SelectItem value={Priority.MEDIUM}>Media</SelectItem>
                      <SelectItem value={Priority.HIGH}>Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as TaskType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Assignee, Creator */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asignado a</Label>
                  <Select
                    value={formData.assignee}
                    onValueChange={(value) => setFormData({ ...formData, assignee: value as TeamMemberName })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_MEMBERS.map((member) => (
                        <SelectItem key={member.name} value={member.name}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${member.color}`}></div>
                            {member.name} ({member.role})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Creado por</Label>
                  <Select
                    value={formData.creator}
                    onValueChange={(value) => setFormData({ ...formData, creator: value as TeamMemberName })}
                  >
                    <SelectTrigger>
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
              </div>

              {/* Row 3: Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de inicio</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha límite</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : editingTask ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nuevo Proyecto</DialogTitle>
            <DialogDescription>Crea un nuevo proyecto para organizar tus tareas</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del proyecto</Label>
              <Input
                placeholder="Nombre del proyecto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-slate-500'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${newProjectColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    onClick={() => setNewProjectColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProject}>Crear Proyecto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onSaveComment={handleSaveComment}
      />
    </div>
  );
}
