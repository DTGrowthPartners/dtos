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
  ChevronLeft,
  Archive,
  RotateCcw,
  AlertCircle,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  deleteProject,
  moveTaskToDeleted,
  copyTaskToCompleted,
  addTaskComment,
  loadCompletedTasks,
  loadDeletedTasks,
  restoreCompletedTask,
  restoreDeletedTask,
  permanentlyDeleteCompletedTask,
  permanentlyDeleteTask,
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
type TaskView = 'active' | 'archived' | 'deleted';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'overdue';

// Helper functions for date filtering - defined at module level to avoid hoisting issues
const isToday = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = new Date();
  const date = new Date(timestamp);
  return date.toDateString() === today.toDateString();
};

const isThisWeek = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = new Date();
  const date = new Date(timestamp);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
};

const isThisMonth = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = new Date();
  const date = new Date(timestamp);
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

const isOverdue = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(timestamp) < today;
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>('active');
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [deleteProjectDialog, setDeleteProjectDialog] = useState<{ open: boolean; projectId: string | null; projectName: string; taskCount: number }>({
    open: false,
    projectId: null,
    projectName: '',
    taskCount: 0,
  });
  const [isDeletingProject, setIsDeletingProject] = useState(false);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, projectsData, archivedData, deletedData] = await Promise.all([
        loadTasks(),
        loadProjects(),
        loadCompletedTasks(),
        loadDeletedTasks(),
      ]);
      setTasks(tasksData);
      setArchivedTasks(archivedData);
      setDeletedTasks(deletedData);
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

  const handleDeleteProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const projectTasks = tasks.filter(t => t.projectId === projectId);

    setDeleteProjectDialog({
      open: true,
      projectId,
      projectName: project?.name || 'Este proyecto',
      taskCount: projectTasks.length,
    });
  };

  const confirmDeleteProject = async () => {
    if (!deleteProjectDialog.projectId) return;

    setIsDeletingProject(true);
    try {
      const projectId = deleteProjectDialog.projectId;
      const projectTasks = tasks.filter(t => t.projectId === projectId);

      // Delete all tasks associated with the project
      for (const task of projectTasks) {
        await moveTaskToDeleted(task.id, task);
      }

      // Delete the project
      await deleteProject(projectId);

      // Update local state
      setTasks(tasks.filter(t => t.projectId !== projectId));
      setProjects(projects.filter(p => p.id !== projectId));

      if (filterProject === projectId) {
        setFilterProject('all');
      }

      toast({
        title: 'Proyecto eliminado',
        description: projectTasks.length > 0
          ? `Se eliminó el proyecto y ${projectTasks.length} tarea(s) asociada(s)`
          : 'El proyecto se eliminó correctamente',
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el proyecto',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingProject(false);
      setDeleteProjectDialog({ open: false, projectId: null, projectName: '', taskCount: 0 });
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

  // Restore archived task
  const handleRestoreArchived = async (taskId: string) => {
    try {
      await restoreCompletedTask(taskId);
      toast({
        title: 'Tarea restaurada',
        description: 'La tarea se movió a tareas activas',
      });
      fetchData();
    } catch (error) {
      console.error('Error restoring task:', error);
      toast({
        title: 'Error',
        description: 'No se pudo restaurar la tarea',
        variant: 'destructive',
      });
    }
  };

  // Restore deleted task
  const handleRestoreDeleted = async (taskId: string) => {
    try {
      await restoreDeletedTask(taskId);
      toast({
        title: 'Tarea restaurada',
        description: 'La tarea se movió a tareas activas',
      });
      fetchData();
    } catch (error) {
      console.error('Error restoring task:', error);
      toast({
        title: 'Error',
        description: 'No se pudo restaurar la tarea',
        variant: 'destructive',
      });
    }
  };

  // Permanently delete archived task
  const handlePermanentDeleteArchived = async (taskId: string) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente esta tarea? Esta acción no se puede deshacer.')) return;
    try {
      await permanentlyDeleteCompletedTask(taskId);
      toast({
        title: 'Tarea eliminada',
        description: 'La tarea se eliminó permanentemente',
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

  // Permanently delete task from trash
  const handlePermanentDeleteTrash = async (taskId: string) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente esta tarea? Esta acción no se puede deshacer.')) return;
    try {
      await permanentlyDeleteTask(taskId);
      toast({
        title: 'Tarea eliminada',
        description: 'La tarea se eliminó permanentemente',
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

    // Date filter
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = isToday(task.dueDate);
    } else if (dateFilter === 'week') {
      matchesDate = isThisWeek(task.dueDate);
    } else if (dateFilter === 'month') {
      matchesDate = isThisMonth(task.dueDate);
    } else if (dateFilter === 'overdue') {
      matchesDate = isOverdue(task.dueDate) && task.status !== TaskStatus.DONE;
    }

    return matchesSearch && matchesProject && matchesAssignee && matchesPriority && matchesDate;
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

  // Helper to count tasks by project (excludes completed tasks)
  const getTaskCountByProject = (projectId: string) => {
    return tasks.filter(t => {
      const isUserTask = loggedUserName
        ? (t.assignee === loggedUserName || t.creator === loggedUserName)
        : true;
      // Don't count completed tasks
      const isNotDone = t.status !== TaskStatus.DONE;
      return isUserTask && t.projectId === projectId && isNotDone;
    }).length;
  };

  // Get counts for date filters (only active, non-completed tasks)
  const getDateFilterCounts = () => {
    const activeTasks = tasks.filter(t => {
      const isUserTask = loggedUserName
        ? (t.assignee === loggedUserName || t.creator === loggedUserName)
        : true;
      return isUserTask && t.status !== TaskStatus.DONE;
    });

    return {
      today: activeTasks.filter(t => isToday(t.dueDate)).length,
      week: activeTasks.filter(t => isThisWeek(t.dueDate)).length,
      month: activeTasks.filter(t => isThisMonth(t.dueDate)).length,
      overdue: activeTasks.filter(t => isOverdue(t.dueDate) && t.status !== TaskStatus.DONE).length,
      all: activeTasks.length,
    };
  };

  const dateFilterCounts = getDateFilterCounts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando tareas...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in h-full flex gap-4">
      {/* Left Sidebar - Projects (Collapsable) */}
      <div className={`flex-shrink-0 flex flex-col gap-3 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-64'}`}>
        {/* Collapse Toggle - At the top */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`w-full h-8 text-muted-foreground hover:text-foreground ${sidebarCollapsed ? 'px-0' : ''}`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span className="text-xs">Colapsar</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          {sidebarCollapsed && <TooltipContent side="right">Expandir</TooltipContent>}
        </Tooltip>

        {/* User Info */}
        <div className="rounded-lg border bg-card p-3">
          {sidebarCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className={`w-8 h-8 mx-auto rounded-full ${TEAM_MEMBERS.find(m => m.name === loggedUserName)?.color || 'bg-primary'} flex items-center justify-center text-white text-xs font-semibold cursor-default`}>
                  {TEAM_MEMBERS.find(m => m.name === loggedUserName)?.initials || user?.firstName?.charAt(0) || '?'}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{loggedUserName || user?.firstName || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground">{TEAM_MEMBERS.find(m => m.name === loggedUserName)?.role || 'Miembro'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Projects List */}
        <div className="rounded-lg border bg-card p-3 flex-1 overflow-hidden flex flex-col">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setFilterProject('all')}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      filterProject === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Todos ({filteredTasks.length})</TooltipContent>
              </Tooltip>
              {projects.map((project) => {
                const count = getTaskCountByProject(project.id);
                return (
                  <Tooltip key={project.id} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setFilterProject(project.id)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                          filterProject === project.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${project.color}`}></div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{project.name} ({count})</TooltipContent>
                  </Tooltip>
                );
              })}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsProjectDialogOpen(true)}
                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors border-2 border-dashed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Nuevo proyecto</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <FolderOpen className="h-4 w-4" />
                  Proyectos
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsProjectDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1 overflow-y-auto flex-1">
                <button
                  onClick={() => setFilterProject('all')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                    filterProject === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-3 w-3" />
                    <span>Todos</span>
                  </div>
                  <span className="text-xs opacity-70">{filteredTasks.length}</span>
                </button>
                {projects.map((project) => {
                  const count = getTaskCountByProject(project.id);
                  return (
                    <div
                      key={project.id}
                      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                        filterProject === project.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <button
                        onClick={() => setFilterProject(project.id)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <div className={`w-3 h-3 rounded-full ${project.color} flex-shrink-0`}></div>
                        <span className="truncate">{project.name}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-xs opacity-70">{count}</span>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id);
                              }}
                              className={`opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center transition-opacity ${
                                filterProject === project.id
                                  ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                                  : 'hover:bg-destructive/10 text-destructive'
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar proyecto</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Quick Filters - Hidden when collapsed */}
        {!sidebarCollapsed && (
          <div className="rounded-lg border bg-card p-3">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
              <Filter className="h-4 w-4" />
              Filtros
            </h3>
            <div className="space-y-2">
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <User className="h-3 w-3 mr-1" />
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
                <SelectTrigger className="w-full h-8 text-xs">
                  <Hash className="h-3 w-3 mr-1" />
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
        )}

        {/* Task Views (Active, Archived, Deleted) */}
        <div className="rounded-lg border bg-card p-3">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTaskView('active')}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      taskView === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Activas ({tasks.length})</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTaskView('archived')}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      taskView === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Archivadas ({archivedTasks.length})</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTaskView('deleted')}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      taskView === 'deleted' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Eliminadas ({deletedTasks.length})</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                <List className="h-4 w-4" />
                Vistas
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setTaskView('active')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                    taskView === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Activas</span>
                  </div>
                  <span className="text-xs opacity-70">{tasks.length}</span>
                </button>
                <button
                  onClick={() => setTaskView('archived')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                    taskView === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Archive className="h-3 w-3" />
                    <span>Archivadas</span>
                  </div>
                  <span className="text-xs opacity-70">{archivedTasks.length}</span>
                </button>
                <button
                  onClick={() => setTaskView('deleted')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                    taskView === 'deleted' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    <span>Eliminadas</span>
                  </div>
                  <span className="text-xs opacity-70">{deletedTasks.length}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* New Task Button */}
        {taskView === 'active' && (
          <div className="space-y-2">
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full"
                    size="icon"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Nueva tarea</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                className="w-full h-8 text-xs"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nueva Tarea
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {taskView === 'active' && 'Mis Tareas'}
              {taskView === 'archived' && 'Tareas Archivadas'}
              {taskView === 'deleted' && 'Tareas Eliminadas'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {taskView === 'active' && (
                <>
                  {filterProject !== 'all' ? projects.find(p => p.id === filterProject)?.name : 'Todos los proyectos'}
                  {' · '}{filteredTasks.length} tareas
                </>
              )}
              {taskView === 'archived' && `${archivedTasks.length} tareas completadas`}
              {taskView === 'deleted' && `${deletedTasks.length} tareas en papelera`}
            </p>
          </div>
          <div className="flex gap-2">
            {taskView === 'active' && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Date Filters - Only show in active view */}
        {taskView === 'active' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateFilter('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dateFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Todas</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dateFilter === 'all' ? 'bg-primary-foreground/20' : 'bg-background'}`}>
                {dateFilterCounts.all}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dateFilter === 'today'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Hoy</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dateFilter === 'today' ? 'bg-white/20' : 'bg-blue-200 dark:bg-blue-800'}`}>
                {dateFilterCounts.today}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dateFilter === 'week'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Esta semana</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dateFilter === 'week' ? 'bg-white/20' : 'bg-purple-200 dark:bg-purple-800'}`}>
                {dateFilterCounts.week}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                dateFilter === 'month'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Este mes</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dateFilter === 'month' ? 'bg-white/20' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                {dateFilterCounts.month}
              </span>
            </button>
            {dateFilterCounts.overdue > 0 && (
              <button
                onClick={() => setDateFilter('overdue')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  dateFilter === 'overdue'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Vencidas</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${dateFilter === 'overdue' ? 'bg-white/20' : 'bg-red-200 dark:bg-red-800'}`}>
                  {dateFilterCounts.overdue}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Active Tasks - Kanban Board */}
        {taskView === 'active' && (
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
        )}

        {/* Archived Tasks View */}
        {taskView === 'archived' && (
          <div className="flex-1 overflow-y-auto">
            {archivedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Archive className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No hay tareas archivadas</p>
                <p className="text-sm">Las tareas completadas aparecerán aquí</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {archivedTasks.map((task) => {
                  const project = getProject(task.projectId);
                  const assignee = getTeamMember(task.assignee);
                  return (
                    <Card key={task.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm line-through text-muted-foreground">
                          {task.title}
                        </h3>
                        <div className="flex gap-1">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRestoreArchived(task.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restaurar</TooltipContent>
                          </Tooltip>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => handlePermanentDeleteArchived(task.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar permanentemente</TooltipContent>
                          </Tooltip>
                        </div>
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
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                        <span>
                          Completada: {task.completedAt ? new Date(task.completedAt).toLocaleDateString('es-ES') : 'N/A'}
                        </span>
                        <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                          {assignee?.initials}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Deleted Tasks View */}
        {taskView === 'deleted' && (
          <div className="flex-1 overflow-y-auto">
            {deletedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Trash2 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">La papelera está vacía</p>
                <p className="text-sm">Las tareas eliminadas aparecerán aquí</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {deletedTasks.map((task) => {
                  const project = getProject(task.projectId);
                  const assignee = getTeamMember(task.assignee);
                  return (
                    <Card key={task.id} className="p-4 border-destructive/30">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm text-muted-foreground">
                          {task.title}
                        </h3>
                        <div className="flex gap-1">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRestoreDeleted(task.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restaurar</TooltipContent>
                          </Tooltip>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                onClick={() => handlePermanentDeleteTrash(task.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar permanentemente</TooltipContent>
                          </Tooltip>
                        </div>
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
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                        <span>
                          Eliminada: {task.deletedAt ? new Date(task.deletedAt).toLocaleDateString('es-ES') : 'N/A'}
                        </span>
                        <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                          {assignee?.initials}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
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

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteProjectDialog.open} onOpenChange={(open) => !open && setDeleteProjectDialog({ open: false, projectId: null, projectName: '', taskCount: 0 })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar proyecto
            </DialogTitle>
            <DialogDescription className="pt-2">
              {deleteProjectDialog.taskCount > 0 ? (
                <>
                  ¿Estás seguro de eliminar <span className="font-semibold">"{deleteProjectDialog.projectName}"</span>?
                  <br /><br />
                  <span className="text-destructive font-medium">
                    Se eliminarán también {deleteProjectDialog.taskCount} tarea(s) asociada(s).
                  </span>
                  <br />
                  Las tareas se moverán a la papelera y podrás restaurarlas si lo necesitas.
                </>
              ) : (
                <>
                  ¿Estás seguro de eliminar <span className="font-semibold">"{deleteProjectDialog.projectName}"</span>?
                  <br />
                  Esta acción no se puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteProjectDialog({ open: false, projectId: null, projectName: '', taskCount: 0 })}
              disabled={isDeletingProject}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={isDeletingProject}
            >
              {isDeletingProject ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
