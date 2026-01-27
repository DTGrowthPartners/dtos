import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  CheckSquare,
  ExternalLink,
  Link,
  GripVertical,
  Flag,
  ArrowRight,
  MoreVertical,
  Pencil,
  FolderArchive,
  Repeat,
  Folder,
  FolderPlus,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  updateProject,
  loadProjectFolders,
  createProjectFolder,
  updateProjectFolder,
  deleteProjectFolder,
  moveTaskToDeleted,
  copyTaskToCompleted,
  addTaskComment,
  loadCompletedTasks,
  loadDeletedTasks,
  restoreCompletedTask,
  restoreDeletedTask,
  permanentlyDeleteCompletedTask,
  permanentlyDeleteTask,
  sendTaskNotification,
  sendHighPriorityTaskToWhatsApp,
  loadProjectNoteColumns,
  createProjectNoteColumn,
  updateProjectNoteColumn,
  deleteProjectNoteColumn,
  loadAllNoteItemsForProject,
  createNoteItem,
  updateNoteItem,
  deleteNoteItem,
  moveNoteItemToColumn,
} from '@/lib/firestoreTaskService';
import {
  type Task,
  type Project,
  type ProjectFolder,
  type TaskComment,
  type TaskChecklistItem,
  type RecurrenceConfig,
  type RecurrenceFrequency,
  type ProjectNoteColumn,
  type NoteItem,
  TaskStatus,
  Priority,
  TASK_TYPES,
  TEAM_MEMBERS,
  DEFAULT_COLUMNS,
  DEFAULT_PROJECTS,
  RECURRENCE_OPTIONS,
  type TaskType,
  type TeamMemberName,
} from '@/types/taskTypes';
import NoteColumn from '@/components/notes/NoteColumn';
import NoteColumnModal from '@/components/notes/NoteColumnModal';
import NoteItemModal from '@/components/notes/NoteItemModal';
import { useAuthStore } from '@/lib/auth';
import { apiClient } from '@/lib/api';

// User interface for team members with photos
interface TeamUser {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
}

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
// These compare only the date portion (year, month, day), ignoring time
const getDateOnly = (timestamp: number): Date => {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const getTodayOnly = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const isToday = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const taskDate = getDateOnly(timestamp);
  const today = getTodayOnly();
  return taskDate.getTime() === today.getTime();
};

const isTomorrow = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const taskDate = getDateOnly(timestamp);
  const today = getTodayOnly();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return taskDate.getTime() === tomorrow.getTime();
};

const isThisWeek = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = getTodayOnly();
  const taskDate = getDateOnly(timestamp);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return taskDate >= startOfWeek && taskDate < endOfWeek;
};

const isThisMonth = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = new Date();
  const taskDate = new Date(timestamp);
  return taskDate.getMonth() === today.getMonth() && taskDate.getFullYear() === today.getFullYear();
};

const isOverdue = (timestamp: number | undefined) => {
  if (!timestamp) return false;
  const today = getTodayOnly();
  const taskDate = getDateOnly(timestamp);
  return taskDate.getTime() < today.getTime();
};

const getDaysOverdue = (timestamp: number | undefined) => {
  if (!timestamp) return 0;
  const today = getTodayOnly();
  const taskDate = getDateOnly(timestamp);
  const diffTime = today.getTime() - taskDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Helper to check if a timestamp has a non-default time (not noon)
const hasTime = (timestamp: number | undefined): boolean => {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  // Consider noon (12:00) as no time set (default)
  return !(hours === 12 && minutes === 0);
};

// Format time from timestamp
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
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
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
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
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize string removing accents for comparison
  const normalizeString = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };

  // Map user firstName or email to team member name (flexible matching)
  const getTeamMemberNameFromUser = (firstName: string | undefined, email: string | undefined): TeamMemberName | undefined => {
    if (!firstName && !email) return undefined;

    // Try matching by first name first
    if (firstName) {
      const normalizedInput = normalizeString(firstName);
      const memberByFirstName = TEAM_MEMBERS.find(m =>
        normalizeString(m.name) === normalizedInput ||
        normalizedInput.startsWith(normalizeString(m.name)) ||
        normalizeString(m.name).startsWith(normalizedInput)
      );
      if (memberByFirstName) return memberByFirstName.name;
    }

    // Try matching by email prefix if first name matching failed
    if (email) {
      const emailPrefix = normalizeString(email.split('@')[0]);
      const memberByEmail = TEAM_MEMBERS.find(m =>
        normalizeString(m.name) === emailPrefix ||
        emailPrefix.includes(normalizeString(m.name))
      );
      if (memberByEmail) return memberByEmail.name;
    }

    return undefined;
  };

  // Get current logged-in user name as identified in our TEAM_MEMBERS system
  const loggedUserName = getTeamMemberNameFromUser(user?.firstName, user?.email);

  // Check if user is admin - admins can see ALL tasks from all team members
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  // Helper to get user photo by name (matches firstName with team member name)
  const getUserPhoto = (assigneeName: string | undefined): string | undefined => {
    if (!assigneeName) return undefined;
    const normalizedName = normalizeString(assigneeName);
    const teamUser = teamUsers.find(u => {
      const normalizedUserFirstName = normalizeString(u.firstName);
      return normalizedUserFirstName === normalizedName ||
        normalizedUserFirstName.startsWith(normalizedName) ||
        normalizedName.startsWith(normalizedUserFirstName);
    });
    return teamUser?.photoUrl;
  };

  // Image and Comments modals
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<Task | null>(null);
  const [checklistInput, setChecklistInput] = useState('');

  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('bg-indigo-500');

  // Edit project state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectColor, setEditProjectColor] = useState('');
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);

  // Archived projects
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);

  // Project Folders
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('bg-gray-500');
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Edit project description
  const [editingProjectDescription, setEditingProjectDescription] = useState(false);
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState('');

  // Edit project chat link
  const [editingChatLink, setEditingChatLink] = useState(false);
  const [chatLinkDraft, setChatLinkDraft] = useState('');

  // Edit project ads manager link
  const [editingAdsManagerLink, setEditingAdsManagerLink] = useState(false);
  const [adsManagerLinkDraft, setAdsManagerLinkDraft] = useState('');

  // Note Columns states
  const [noteColumns, setNoteColumns] = useState<ProjectNoteColumn[]>([]);
  const [noteItems, setNoteItems] = useState<NoteItem[]>([]);
  const [isNoteColumnModalOpen, setIsNoteColumnModalOpen] = useState(false);
  const [editingNoteColumn, setEditingNoteColumn] = useState<ProjectNoteColumn | null>(null);
  const [isNoteItemModalOpen, setIsNoteItemModalOpen] = useState(false);
  const [editingNoteItem, setEditingNoteItem] = useState<NoteItem | null>(null);
  const [selectedNoteColumnId, setSelectedNoteColumnId] = useState<string | null>(null);
  const [draggedNoteItem, setDraggedNoteItem] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

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
    dueTime: '',
    startDate: '',
    startTime: '',
    images: [] as string[],
    checklist: [] as TaskChecklistItem[],
    // Recurrence fields
    isRecurring: false,
    recurrenceFrequency: 'weekly' as RecurrenceFrequency,
    recurrenceDayOfWeek: 1, // Monday by default
    recurrenceDayOfMonth: 1,
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL parameters (taskId to edit, action=new to create)
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    const action = searchParams.get('action');

    // Handle action=new to open new task modal
    if (action === 'new' && !isLoading) {
      resetForm();
      setIsDialogOpen(true);
      setSearchParams({}, { replace: true });
      return;
    }

    // Handle taskId to edit existing task
    if (taskId && tasks.length > 0 && !isLoading) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
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
          dueTime: task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '',
          startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
          startTime: task.startDate ? new Date(task.startDate).toTimeString().slice(0, 5) : '',
          images: task.images || [],
          checklist: task.checklist || [],
          isRecurring: task.recurrence?.enabled || false,
          recurrenceFrequency: task.recurrence?.frequency || 'weekly',
          recurrenceDayOfWeek: task.recurrence?.dayOfWeek ?? 1,
          recurrenceDayOfMonth: task.recurrence?.dayOfMonth ?? 1,
        });
        setIsDialogOpen(true);
        // Clear the URL parameter after opening
        setSearchParams({}, { replace: true });
      }
    }
  }, [tasks, isLoading, searchParams, setSearchParams]);

  // Load note columns when project filter changes
  useEffect(() => {
    const loadNotes = async () => {
      if (filterProject === 'all') {
        setNoteColumns([]);
        setNoteItems([]);
        return;
      }

      try {
        const [columns, items] = await Promise.all([
          loadProjectNoteColumns(filterProject),
          loadAllNoteItemsForProject(filterProject),
        ]);
        setNoteColumns(columns);
        setNoteItems(items);
      } catch (error) {
        console.error('Error loading notes:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las notas del proyecto',
          variant: 'destructive',
        });
      }
    };

    loadNotes();
  }, [filterProject, toast]);

  // Process recurring tasks and create new instances if needed
  const processRecurringTasks = async (tasksData: Task[]) => {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    // Helper to compare only dates (ignoring time)
    const isSameDayOrPast = (timestamp: number): boolean => {
      const targetDate = new Date(timestamp);
      targetDate.setHours(0, 0, 0, 0);
      return targetDate.getTime() <= todayTimestamp;
    };

    // Helper to check if two timestamps are the same day
    const isSameDay = (ts1: number, ts2: number): boolean => {
      const d1 = new Date(ts1);
      const d2 = new Date(ts2);
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    };

    for (const task of tasksData) {
      if (task.recurrence?.enabled && task.recurrence.nextOccurrence) {
        // Check if it's time to create a new instance (compare dates only, not exact timestamps)
        if (isSameDayOrPast(task.recurrence.nextOccurrence)) {
          // IMPORTANT: Check if we already generated for this occurrence
          // If lastGenerated exists and is on the same day or after nextOccurrence, skip
          if (task.recurrence.lastGenerated) {
            const lastGenDate = new Date(task.recurrence.lastGenerated);
            lastGenDate.setHours(0, 0, 0, 0);
            const nextOccDate = new Date(task.recurrence.nextOccurrence);
            nextOccDate.setHours(0, 0, 0, 0);

            if (lastGenDate.getTime() >= nextOccDate.getTime()) {
              console.log(`[Recurrence] Skipping ${task.title} - already generated for this occurrence`);
              continue; // Skip - already generated for this occurrence
            }
          }

          // Check if there's already an instance for this date to prevent duplicates
          const existingInstance = tasksData.find(t =>
            t.recurringTemplateId === task.id &&
            t.dueDate &&
            isSameDay(t.dueDate, task.recurrence!.nextOccurrence)
          );

          if (existingInstance) {
            console.log(`[Recurrence] Skipping ${task.title} - instance already exists for this date`);
            // Update lastGenerated to prevent future duplicate attempts
            await updateTask(task.id, {
              recurrence: {
                ...task.recurrence,
                lastGenerated: now,
              },
            });
            continue;
          }

          try {
            // Create new task instance
            const newTaskData: Omit<Task, 'id' | 'createdAt'> = {
              title: task.title,
              description: task.description,
              status: TaskStatus.TODO,
              priority: task.priority,
              assignee: task.assignee,
              creator: task.creator,
              projectId: task.projectId,
              type: task.type,
              dueDate: task.recurrence.nextOccurrence,
              isRecurringInstance: true,
              recurringTemplateId: task.id,
            };

            await createTask(newTaskData);

            // Calculate next occurrence
            let nextOccurrence: number;
            const currentOccurrence = new Date(task.recurrence.nextOccurrence);

            switch (task.recurrence.frequency) {
              case 'daily':
                currentOccurrence.setDate(currentOccurrence.getDate() + 1);
                nextOccurrence = currentOccurrence.getTime();
                break;
              case 'weekly':
                currentOccurrence.setDate(currentOccurrence.getDate() + 7);
                nextOccurrence = currentOccurrence.getTime();
                break;
              case 'biweekly':
                currentOccurrence.setDate(currentOccurrence.getDate() + 14);
                nextOccurrence = currentOccurrence.getTime();
                break;
              case 'monthly':
                currentOccurrence.setMonth(currentOccurrence.getMonth() + 1);
                nextOccurrence = currentOccurrence.getTime();
                break;
              default:
                nextOccurrence = currentOccurrence.getTime();
            }

            // Update the template task with new next occurrence
            await updateTask(task.id, {
              recurrence: {
                ...task.recurrence,
                nextOccurrence,
                lastGenerated: now,
              },
            });

            console.log(`[Recurrence] Created recurring task instance for: ${task.title}`);
          } catch (error) {
            console.error(`[Recurrence] Error processing recurring task ${task.id}:`, error);
          }
        }
      }
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, projectsData, archivedData, deletedData, foldersData, usersData] = await Promise.all([
        loadTasks(),
        loadProjects(),
        loadCompletedTasks(),
        loadDeletedTasks(),
        loadProjectFolders(),
        apiClient.get<TeamUser[]>('/api/users').catch(() => []),
      ]);

      // Store team users for photos
      setTeamUsers(usersData);

      // Process recurring tasks
      await processRecurringTasks(tasksData);

      // Reload tasks after processing recurring ones
      const updatedTasks = await loadTasks();
      setTasks(updatedTasks);
      setArchivedTasks(archivedData);
      setDeletedTasks(deletedData);
      // Load folders
      const sortedFolders = foldersData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setFolders(sortedFolders);
      // Expand all folders by default
      setExpandedFolders(new Set(sortedFolders.map(f => f.id)));
      // Use loaded projects or default if none exist, sorted by order
      // Separate active and archived projects
      const allProjects = projectsData.length > 0 ? projectsData : DEFAULT_PROJECTS;
      const sortedActiveProjects = allProjects
        .filter(p => !p.archived)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      const sortedArchivedProjects = allProjects
        .filter(p => p.archived)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setProjects(sortedActiveProjects);
      setArchivedProjects(sortedArchivedProjects);
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

    // Calculate next occurrence for recurring tasks (preserves task time)
    const calculateNextOccurrence = (): number => {
      const now = new Date();
      // Use task's dueTime if set, otherwise default to 9 AM
      if (formData.dueTime) {
        const [hours, minutes] = formData.dueTime.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);
      } else {
        now.setHours(9, 0, 0, 0);
      }

      switch (formData.recurrenceFrequency) {
        case 'daily': {
          // Next day
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow.getTime();
        }

        case 'weekly':
        case 'biweekly': {
          // Find next occurrence of the selected day
          const targetDay = formData.recurrenceDayOfWeek;
          const currentDay = now.getDay();
          let daysUntilTarget = targetDay - currentDay;
          if (daysUntilTarget <= 0) daysUntilTarget += 7;
          if (formData.recurrenceFrequency === 'biweekly' && daysUntilTarget === 7) {
            daysUntilTarget += 7;
          }
          const nextWeekday = new Date(now);
          nextWeekday.setDate(now.getDate() + daysUntilTarget);
          return nextWeekday.getTime();
        }

        case 'monthly': {
          // Find next occurrence of the selected day of month
          const targetDayOfMonth = formData.recurrenceDayOfMonth;
          const nextMonth = new Date(now);
          if (now.getDate() >= targetDayOfMonth) {
            nextMonth.setMonth(nextMonth.getMonth() + 1);
          }
          nextMonth.setDate(targetDayOfMonth);
          return nextMonth.getTime();
        }

        default:
          return now.getTime();
      }
    };

    // Helper to parse date and time string as local date (not UTC)
    const parseLocalDateTime = (dateStr: string, timeStr?: string): number => {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, 0).getTime();
      }
      // Default to noon if no time specified to avoid timezone issues
      return new Date(year, month - 1, day, 12, 0, 0).getTime();
    };

    const taskData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: formData.status,
      priority: formData.priority,
      assignee: formData.assignee,
      creator: formData.creator,
      projectId: formData.projectId,
      type: formData.type || undefined,
      dueDate: formData.dueDate ? parseLocalDateTime(formData.dueDate, formData.dueTime) : undefined,
      startDate: formData.startDate ? parseLocalDateTime(formData.startDate, formData.startTime) : undefined,
      images: formData.images,
      checklist: formData.checklist,
      recurrence: formData.isRecurring ? {
        enabled: true,
        frequency: formData.recurrenceFrequency,
        dayOfWeek: formData.recurrenceDayOfWeek,
        dayOfMonth: formData.recurrenceDayOfMonth,
        nextOccurrence: calculateNextOccurrence(),
        lastGenerated: Date.now(),
      } : undefined,
    };

    try {
      if (editingTask) {
        await updateTask(editingTask.id, taskData);

        // Send notification if assignee changed
        const assigneeChanged = editingTask.assignee !== taskData.assignee;
        if (assigneeChanged && taskData.assignee && user?.firstName) {
          sendTaskNotification({
            type: 'task_assigned',
            taskTitle: taskData.title,
            taskId: editingTask.id,
            assigneeName: taskData.assignee,
            senderName: user.firstName,
          });
        }

        toast({
          title: 'Tarea actualizada',
          description: 'La tarea se actualizó correctamente',
        });
      } else {
        const newTaskId = await createTask(taskData as Omit<Task, 'id' | 'createdAt'>);

        // If this is a recurring task, create the first instance immediately
        if (formData.isRecurring) {
          const firstInstanceData: Omit<Task, 'id' | 'createdAt'> = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            status: TaskStatus.TODO,
            priority: formData.priority,
            assignee: formData.assignee,
            creator: formData.creator,
            projectId: formData.projectId,
            type: formData.type || undefined,
            dueDate: formData.dueDate ? parseLocalDateTime(formData.dueDate, formData.dueTime) : Date.now(),
            isRecurringInstance: true,
            recurringTemplateId: newTaskId,
          };

          const firstInstanceId = await createTask(firstInstanceData);
          console.log('[Recurrence] Created first instance for recurring task:', firstInstanceId);

          // Send notification to assignee for the instance (not the template)
          if (taskData.assignee && user?.firstName && taskData.assignee !== user.firstName) {
            sendTaskNotification({
              type: 'task_assigned',
              taskTitle: taskData.title,
              taskId: firstInstanceId,
              assigneeName: taskData.assignee,
              senderName: user.firstName,
            });
          }

          // Send to WhatsApp webhook if high priority
          if (taskData.priority === Priority.HIGH) {
            const project = projects.find(p => p.id === taskData.projectId);
            sendHighPriorityTaskToWhatsApp({
              id: firstInstanceId,
              titulo: taskData.title,
              descripcion: taskData.description || '',
              prioridad: 'Alta',
              asignado: taskData.assignee,
              creador: taskData.creator,
              proyecto: project?.name || 'Sin proyecto',
              fechaLimite: taskData.dueDate ? new Date(taskData.dueDate).toISOString().split('T')[0] : null,
            });
          }
        } else {
          // Non-recurring task - send notifications normally
          if (taskData.assignee && user?.firstName && taskData.assignee !== user.firstName) {
            sendTaskNotification({
              type: 'task_assigned',
              taskTitle: taskData.title,
              taskId: newTaskId,
              assigneeName: taskData.assignee,
              senderName: user.firstName,
            });
          }

          // Send to WhatsApp webhook if high priority
          if (taskData.priority === Priority.HIGH) {
            const project = projects.find(p => p.id === taskData.projectId);
            sendHighPriorityTaskToWhatsApp({
              id: newTaskId,
              titulo: taskData.title,
              descripcion: taskData.description || '',
              prioridad: 'Alta',
              asignado: taskData.assignee,
              creador: taskData.creator,
              proyecto: project?.name || 'Sin proyecto',
              fechaLimite: taskData.dueDate ? new Date(taskData.dueDate).toISOString().split('T')[0] : null,
            });
          }
        }

        toast({
          title: duplicatingTask ? 'Tarea duplicada' : formData.isRecurring ? 'Tarea recurrente creada' : 'Tarea creada',
          description: duplicatingTask
            ? 'La tarea se duplicó correctamente'
            : formData.isRecurring
              ? 'Se creó la tarea recurrente y su primera instancia'
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

  const handleSaveProjectDescription = async () => {
    if (filterProject === 'all') return;

    try {
      await updateProject(filterProject, { description: projectDescriptionDraft });
      setProjects(prev => prev.map(p =>
        p.id === filterProject ? { ...p, description: projectDescriptionDraft } : p
      ));
      setEditingProjectDescription(false);
      toast({
        title: 'Descripción actualizada',
      });
    } catch (error) {
      console.error('Error updating project description:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la descripción',
        variant: 'destructive',
      });
    }
  };

  const handleSaveChatLink = async () => {
    if (filterProject === 'all') return;

    try {
      await updateProject(filterProject, { chatLink: chatLinkDraft });
      setProjects(prev => prev.map(p =>
        p.id === filterProject ? { ...p, chatLink: chatLinkDraft } : p
      ));
      setEditingChatLink(false);
      toast({
        title: 'Link del grupo actualizado',
      });
    } catch (error) {
      console.error('Error updating chat link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el link',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAdsManagerLink = async () => {
    if (filterProject === 'all') return;

    try {
      await updateProject(filterProject, { adsManagerLink: adsManagerLinkDraft });
      setProjects(prev => prev.map(p =>
        p.id === filterProject ? { ...p, adsManagerLink: adsManagerLinkDraft } : p
      ));
      setEditingAdsManagerLink(false);
      toast({
        title: 'Link de Ads Manager actualizado',
      });
    } catch (error) {
      console.error('Error updating Ads Manager link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el link',
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

  // Edit project
  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectColor(project.color);
    setIsEditProjectDialogOpen(true);
  };

  const handleSaveEditProject = async () => {
    if (!editingProject || !editProjectName.trim()) return;

    try {
      await updateProject(editingProject.id, {
        name: editProjectName.trim(),
        color: editProjectColor,
      });
      setProjects(prev => prev.map(p =>
        p.id === editingProject.id
          ? { ...p, name: editProjectName.trim(), color: editProjectColor }
          : p
      ));
      setIsEditProjectDialogOpen(false);
      setEditingProject(null);
      toast({
        title: 'Proyecto actualizado',
        description: 'El proyecto se actualizó correctamente',
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el proyecto',
        variant: 'destructive',
      });
    }
  };

  // Archive project
  const handleArchiveProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    try {
      await updateProject(projectId, { archived: true });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setArchivedProjects(prev => [...prev, { ...project, archived: true }]);

      if (filterProject === projectId) {
        setFilterProject('all');
      }

      toast({
        title: 'Proyecto archivado',
        description: 'El proyecto se archivó correctamente',
      });
    } catch (error) {
      console.error('Error archiving project:', error);
      toast({
        title: 'Error',
        description: 'No se pudo archivar el proyecto',
        variant: 'destructive',
      });
    }
  };

  // Restore archived project
  const handleRestoreProject = async (projectId: string) => {
    const project = archivedProjects.find(p => p.id === projectId);
    if (!project) return;

    try {
      await updateProject(projectId, { archived: false });
      setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
      setProjects(prev => [...prev, { ...project, archived: false }]);

      toast({
        title: 'Proyecto restaurado',
        description: 'El proyecto se restauró correctamente',
      });
    } catch (error) {
      console.error('Error restoring project:', error);
      toast({
        title: 'Error',
        description: 'No se pudo restaurar el proyecto',
        variant: 'destructive',
      });
    }
  };

  // ============= FOLDER HANDLERS =============

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre de la carpeta es requerido',
        variant: 'destructive',
      });
      return;
    }

    try {
      const folderId = await createProjectFolder({
        name: newFolderName.trim(),
        color: newFolderColor,
        order: folders.length,
        expanded: true,
      });
      setFolders([...folders, { id: folderId, name: newFolderName.trim(), color: newFolderColor, order: folders.length, expanded: true }]);
      setExpandedFolders(prev => new Set([...prev, folderId]));
      setIsFolderDialogOpen(false);
      setNewFolderName('');
      setNewFolderColor('bg-gray-500');
      toast({
        title: 'Carpeta creada',
        description: 'La carpeta se creó correctamente',
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Error al crear la carpeta',
        variant: 'destructive',
      });
    }
  };

  const handleEditFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    try {
      await updateProjectFolder(editingFolder.id, {
        name: newFolderName.trim(),
        color: newFolderColor,
      });
      setFolders(prev => prev.map(f =>
        f.id === editingFolder.id
          ? { ...f, name: newFolderName.trim(), color: newFolderColor }
          : f
      ));
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      setNewFolderName('');
      setNewFolderColor('bg-gray-500');
      toast({
        title: 'Carpeta actualizada',
      });
    } catch (error) {
      console.error('Error updating folder:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la carpeta',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Check if folder has projects
    const projectsInFolder = projects.filter(p => p.folderId === folderId);
    if (projectsInFolder.length > 0) {
      toast({
        title: 'No se puede eliminar',
        description: 'La carpeta tiene proyectos. Muévelos primero.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteProjectFolder(folderId);
      setFolders(prev => prev.filter(f => f.id !== folderId));
      toast({
        title: 'Carpeta eliminada',
      });
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la carpeta',
        variant: 'destructive',
      });
    }
  };

  const handleMoveProjectToFolder = async (projectId: string, folderId: string | null) => {
    try {
      await updateProject(projectId, { folderId: folderId || undefined });
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, folderId: folderId || undefined } : p
      ));
      toast({
        title: folderId ? 'Proyecto movido a carpeta' : 'Proyecto sacado de carpeta',
      });
    } catch (error) {
      console.error('Error moving project:', error);
      toast({
        title: 'Error',
        description: 'No se pudo mover el proyecto',
        variant: 'destructive',
      });
    }
  };

  // Get projects in a folder
  const getProjectsInFolder = (folderId: string) => {
    return projects.filter(p => p.folderId === folderId);
  };

  // Get projects without folder
  const getProjectsWithoutFolder = () => {
    return projects.filter(p => !p.folderId);
  };

  // ============= NOTE COLUMN HANDLERS =============

  const handleAddNoteColumn = () => {
    setEditingNoteColumn(null);
    setIsNoteColumnModalOpen(true);
  };

  const handleEditNoteColumn = (column: ProjectNoteColumn) => {
    setEditingNoteColumn(column);
    setIsNoteColumnModalOpen(true);
  };

  const handleSaveNoteColumn = async (data: { name: string; color: string }) => {
    if (filterProject === 'all') return;

    setIsSavingNote(true);
    try {
      if (editingNoteColumn) {
        await updateProjectNoteColumn(editingNoteColumn.id, data);
        setNoteColumns(prev => prev.map(col =>
          col.id === editingNoteColumn.id ? { ...col, ...data } : col
        ));
        toast({ title: 'Columna actualizada' });
      } else {
        const newColumnId = await createProjectNoteColumn({
          ...data,
          projectId: filterProject,
          order: noteColumns.length,
        });
        const newColumn: ProjectNoteColumn = {
          id: newColumnId,
          ...data,
          projectId: filterProject,
          order: noteColumns.length,
          createdAt: Date.now(),
        };
        setNoteColumns(prev => [...prev, newColumn]);
        toast({ title: 'Columna creada' });
      }
      setIsNoteColumnModalOpen(false);
      setEditingNoteColumn(null);
    } catch (error) {
      console.error('Error saving note column:', error);
      toast({ title: 'Error', description: 'No se pudo guardar la columna', variant: 'destructive' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNoteColumn = async (columnId: string) => {
    if (!confirm('¿Se eliminará esta columna y todas sus notas. Continuar?')) return;

    try {
      await deleteProjectNoteColumn(columnId);
      setNoteColumns(prev => prev.filter(col => col.id !== columnId));
      setNoteItems(prev => prev.filter(item => item.columnId !== columnId));
      toast({ title: 'Columna eliminada' });
    } catch (error) {
      console.error('Error deleting note column:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar la columna', variant: 'destructive' });
    }
  };

  // ============= NOTE ITEM HANDLERS =============

  const handleAddNoteItem = (columnId: string) => {
    setSelectedNoteColumnId(columnId);
    setEditingNoteItem(null);
    setIsNoteItemModalOpen(true);
  };

  const handleEditNoteItem = (item: NoteItem) => {
    setSelectedNoteColumnId(item.columnId);
    setEditingNoteItem(item);
    setIsNoteItemModalOpen(true);
  };

  const handleSaveNoteItem = async (data: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => {
    setIsSavingNote(true);
    try {
      if (editingNoteItem) {
        await updateNoteItem(editingNoteItem.id, data);
        setNoteItems(prev => prev.map(item =>
          item.id === editingNoteItem.id ? { ...item, ...data, updatedAt: Date.now() } : item
        ));
        toast({ title: 'Nota actualizada' });
      } else {
        const columnItems = noteItems.filter(i => i.columnId === data.columnId);
        const newItemId = await createNoteItem({
          ...data,
          order: columnItems.length,
        });
        const newItem: NoteItem = {
          id: newItemId,
          ...data,
          order: columnItems.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setNoteItems(prev => [...prev, newItem]);
        toast({ title: 'Nota creada' });
      }
      setIsNoteItemModalOpen(false);
      setEditingNoteItem(null);
      setSelectedNoteColumnId(null);
    } catch (error) {
      console.error('Error saving note item:', error);
      toast({ title: 'Error', description: 'No se pudo guardar la nota', variant: 'destructive' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNoteItem = async (itemId: string) => {
    try {
      await deleteNoteItem(itemId);
      setNoteItems(prev => prev.filter(item => item.id !== itemId));
      toast({ title: 'Nota eliminada' });
    } catch (error) {
      console.error('Error deleting note item:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar la nota', variant: 'destructive' });
    }
  };

  // Drag and drop for note items
  const handleNoteItemDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('noteItemId');

    if (!itemId) return;

    const item = noteItems.find(i => i.id === itemId);
    if (!item || item.columnId === targetColumnId) {
      setDraggedNoteItem(null);
      return;
    }

    try {
      const targetColumnItems = noteItems.filter(i => i.columnId === targetColumnId);
      const newOrder = targetColumnItems.length;

      await moveNoteItemToColumn(itemId, targetColumnId, newOrder);

      setNoteItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, columnId: targetColumnId, order: newOrder } : i
      ));

      toast({ title: 'Nota movida' });
    } catch (error) {
      console.error('Error moving note item:', error);
      toast({ title: 'Error', description: 'No se pudo mover la nota', variant: 'destructive' });
    }

    setDraggedNoteItem(null);
  };

  // Helper to get items for a note column
  const getNoteItemsForColumn = (columnId: string) => {
    return noteItems.filter(item => item.columnId === columnId).sort((a, b) => a.order - b.order);
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
      dueTime: task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      startTime: task.startDate ? new Date(task.startDate).toTimeString().slice(0, 5) : '',
      images: task.images || [],
      checklist: task.checklist || [],
      isRecurring: task.recurrence?.enabled || false,
      recurrenceFrequency: task.recurrence?.frequency || 'weekly',
      recurrenceDayOfWeek: task.recurrence?.dayOfWeek ?? 1,
      recurrenceDayOfMonth: task.recurrence?.dayOfMonth ?? 1,
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
      dueTime: '',
      startDate: '',
      startTime: '',
      images: task.images || [],
      checklist: [],
      isRecurring: false,
      recurrenceFrequency: 'weekly',
      recurrenceDayOfWeek: 1,
      recurrenceDayOfMonth: 1,
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
        // If already done, move back to TODO
        await updateTask(task.id, { status: TaskStatus.TODO });
      } else {
        // Mark as done and copy to completed tasks
        await updateTask(task.id, { status: TaskStatus.DONE, completedAt: Date.now() });
        await copyTaskToCompleted(task.id, { ...task, status: TaskStatus.DONE });

        // Notify creator that task was completed
        if (task.creator && user?.firstName && task.creator !== user.firstName) {
          sendTaskNotification({
            type: 'task_completed',
            taskTitle: task.title,
            taskId: task.id,
            assigneeName: task.creator, // Notify the creator
            senderName: user.firstName,
          });
        }
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

  // Quick actions for context menu
  const handleQuickStatusChange = async (task: Task, newStatus: TaskStatus) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === task.id ? { ...t, status: newStatus } : t
      )
    );
    try {
      await updateTask(task.id, { status: newStatus });
      if (newStatus === TaskStatus.DONE) {
        await copyTaskToCompleted(task.id, { ...task, status: TaskStatus.DONE });
      }
      toast({
        title: 'Estado actualizado',
        description: `Tarea movida a ${newStatus === TaskStatus.TODO ? 'Por hacer' : newStatus === TaskStatus.IN_PROGRESS ? 'En progreso' : 'Completada'}`,
      });
    } catch {
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id ? { ...t, status: task.status } : t
        )
      );
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
    }
  };

  const handleQuickPriorityChange = async (task: Task, newPriority: Priority) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === task.id ? { ...t, priority: newPriority } : t
      )
    );
    try {
      await updateTask(task.id, { priority: newPriority });
      toast({
        title: 'Prioridad actualizada',
        description: `Prioridad cambiada a ${newPriority === Priority.HIGH ? 'Alta' : newPriority === Priority.MEDIUM ? 'Media' : 'Baja'}`,
      });
    } catch {
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id ? { ...t, priority: task.priority } : t
        )
      );
      toast({ title: 'Error', description: 'No se pudo actualizar la prioridad', variant: 'destructive' });
    }
  };

  const handleQuickProjectChange = async (task: Task, newProjectId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === task.id ? { ...t, projectId: newProjectId } : t
      )
    );
    try {
      await updateTask(task.id, { projectId: newProjectId });
      const projectName = projects.find(p => p.id === newProjectId)?.name || 'Sin proyecto';
      toast({
        title: 'Proyecto actualizado',
        description: `Tarea movida a ${projectName}`,
      });
    } catch {
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id ? { ...t, projectId: task.projectId } : t
        )
      );
      toast({ title: 'Error', description: 'No se pudo cambiar el proyecto', variant: 'destructive' });
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
      projectId: filterProject !== 'all' ? filterProject : '',
      type: '',
      dueDate: '',
      dueTime: '',
      startDate: '',
      startTime: '',
      images: [],
      checklist: [],
      isRecurring: false,
      recurrenceFrequency: 'weekly',
      recurrenceDayOfWeek: 1,
      recurrenceDayOfMonth: 1,
    });
    setEditingTask(null);
    setDuplicatingTask(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTask(taskId);
    // Add a slight delay to set dragging state for visual feedback
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedTask(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);

    if (taskId && task && task.status !== newStatus) {
      try {
        const updateData: Partial<Task> = { status: newStatus };
        if (newStatus === TaskStatus.DONE) {
          updateData.completedAt = Date.now();
          await copyTaskToCompleted(taskId, { ...task, status: newStatus });

          // Notify creator that task was completed
          if (task.creator && user?.firstName && task.creator !== user.firstName) {
            sendTaskNotification({
              type: 'task_completed',
              taskTitle: task.title,
              taskId: task.id,
              assigneeName: task.creator,
              senderName: user.firstName,
            });
          }
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

  // Project Drag and Drop handlers
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', projectId);
    setDraggedProject(projectId);
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handleProjectDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedProject(null);
  };

  const handleProjectDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleProjectDrop = async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    const sourceProjectId = e.dataTransfer.getData('text/plain');

    if (!sourceProjectId || sourceProjectId === targetProjectId) {
      setDraggedProject(null);
      return;
    }

    const sourceIndex = projects.findIndex(p => p.id === sourceProjectId);
    const targetIndex = projects.findIndex(p => p.id === targetProjectId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedProject(null);
      return;
    }

    // Reorder projects
    const newProjects = [...projects];
    const [removed] = newProjects.splice(sourceIndex, 1);
    newProjects.splice(targetIndex, 0, removed);

    // Update order for each project
    const updatedProjects = newProjects.map((p, index) => ({ ...p, order: index }));
    setProjects(updatedProjects);

    // Save new order to Firebase
    try {
      for (const project of updatedProjects) {
        await updateProject(project.id, { order: project.order });
      }
      toast({
        title: 'Proyectos reordenados',
      });
    } catch (error) {
      console.error('Error saving project order:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el orden',
        variant: 'destructive',
      });
    }

    setDraggedProject(null);
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

      // Send notification to task creator if different from comment author
      const task = tasks.find(t => t.id === taskId) || selectedTaskForComments;
      if (task && task.creator && user?.firstName) {
        // Only notify if the comment author is different from the task creator
        const commenterName = user.firstName;
        if (task.creator !== commenterName) {
          sendTaskNotification({
            type: 'task_comment',
            taskTitle: task.title,
            taskId: taskId,
            assigneeName: task.creator, // This is used to find the creator in the backend
            senderName: commenterName,
          });
        }
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
  console.log('User:', user?.firstName, '-> Mapped to:', loggedUserName, '| Admin:', isAdmin);

  // Filter tasks - only show tasks where user is creator or assignee
  // Admins can see ALL tasks from all team members
  const filteredTasks = tasks.filter((task) => {
    // SECURITY FILTER:
    // 1. Admins see everything.
    // 2. Regular users see tasks where they are the assignee OR the creator.
    // 3. If we can't identify the user (loggedUserName is undefined), and they aren't admin,
    //    they shouldn't see anything (unless we want to matching by email as fallback).

    let isUserTask = isAdmin;

    if (!isUserTask && loggedUserName) {
      const normalizedLoggedUser = normalizeString(loggedUserName);
      const normalizedAssignee = task.assignee ? normalizeString(task.assignee) : '';
      const normalizedCreator = task.creator ? normalizeString(task.creator) : '';

      isUserTask = normalizedAssignee === normalizedLoggedUser ||
        normalizedCreator === normalizedLoggedUser ||
        normalizedAssignee.includes(normalizedLoggedUser) ||
        normalizedLoggedUser.includes(normalizedAssignee);
    }

    // If we still haven't identified it as a user task, and user is NOT admin, reject.
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

    // Hide recurring TEMPLATES from the task list - only show instances
    // Templates have recurrence.enabled = true, instances have isRecurringInstance = true
    const isRecurringTemplate = task.recurrence?.enabled === true;
    if (isRecurringTemplate) return false;

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
  // Admins see counts for ALL tasks, regular users only their own
  const getTaskCountByProject = (projectId: string) => {
    return tasks.filter(t => {
      let isUserTask = isAdmin;
      if (!isUserTask && loggedUserName) {
        isUserTask = (t.assignee === loggedUserName || t.creator === loggedUserName);
      }

      if (!isUserTask) return false;

      // Don't count completed tasks
      const isNotDone = t.status !== TaskStatus.DONE;
      return isUserTask && t.projectId === projectId && isNotDone;
    }).length;
  };

  // Get counts for date filters (only active, non-completed tasks, respecting current filters)
  // Admins see counts for ALL tasks
  const getDateFilterCounts = () => {
    const activeTasks = tasks.filter(t => {
      let isUserTask = isAdmin;
      if (!isUserTask && loggedUserName) {
        isUserTask = (t.assignee === loggedUserName || t.creator === loggedUserName);
      }

      if (!isUserTask) return false;

      const matchesProject = filterProject === 'all' || t.projectId === filterProject;
      const matchesAssignee = filterAssignee === 'all' || t.assignee === filterAssignee;
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      return isUserTask && t.status !== TaskStatus.DONE && matchesProject && matchesAssignee && matchesPriority;
    });

    return {
      today: activeTasks.filter(t => isToday(t.dueDate)).length,
      week: activeTasks.filter(t => isThisWeek(t.dueDate)).length,
      month: activeTasks.filter(t => isThisMonth(t.dueDate)).length,
      overdue: activeTasks.filter(t => isOverdue(t.dueDate)).length,
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
    <div className="animate-fade-in h-full flex gap-2 md:gap-4">
      {/* Left Sidebar - Projects (Collapsable) - Hidden on mobile */}
      <div className={`hidden md:flex flex-shrink-0 flex-col gap-3 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-64'}`}>
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
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="w-8 h-8 mx-auto rounded-full object-cover cursor-default"
                  />
                ) : (
                  <div className={`w-8 h-8 mx-auto rounded-full ${TEAM_MEMBERS.find(m => m.name === loggedUserName)?.color || 'bg-primary'} flex items-center justify-center text-white text-xs font-semibold cursor-default`}>
                    {TEAM_MEMBERS.find(m => m.name === loggedUserName)?.initials || user?.firstName?.charAt(0) || '?'}
                  </div>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{loggedUserName || user?.firstName || 'Usuario'}</p>
                <p className="text-xs text-muted-foreground">{TEAM_MEMBERS.find(m => m.name === loggedUserName)?.role || 'Miembro'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full ${TEAM_MEMBERS.find(m => m.name === loggedUserName)?.color || 'bg-primary'} flex items-center justify-center text-white font-semibold`}>
                    {TEAM_MEMBERS.find(m => m.name === loggedUserName)?.initials || user?.firstName?.charAt(0) || '?'}
                  </div>
                )}
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
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${filterProject === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${filterProject === project.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                <div className="flex items-center gap-1">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingFolder(null);
                          setNewFolderName('');
                          setNewFolderColor('bg-gray-500');
                          setIsFolderDialogOpen(true);
                        }}
                      >
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nueva carpeta</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsProjectDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 overflow-y-auto flex-1">
                <button
                  onClick={() => setFilterProject('all')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${filterProject === 'all'
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

                {/* Folders with nested projects */}
                {folders.map((folder) => {
                  const folderProjects = getProjectsInFolder(folder.id);
                  const isExpanded = expandedFolders.has(folder.id);
                  const folderTaskCount = folderProjects.reduce((sum, p) => sum + getTaskCountByProject(p.id), 0);

                  return (
                    <div key={folder.id} className="space-y-0.5">
                      {/* Folder header */}
                      <div className="group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors">
                        <button
                          onClick={() => toggleFolderExpanded(folder.id)}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                          <Folder className={`h-3 w-3 flex-shrink-0 ${folder.color.replace('bg-', 'text-')}`} />
                          <span className="truncate font-medium">{folder.name}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <span className="text-xs opacity-70">{folderTaskCount}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => {
                                setEditingFolder(folder);
                                setNewFolderName(folder.name);
                                setNewFolderColor(folder.color);
                                setIsFolderDialogOpen(true);
                              }}>
                                <Pencil className="h-3 w-3 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteFolder(folder.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Projects inside folder */}
                      {isExpanded && folderProjects.map((project) => {
                        const count = getTaskCountByProject(project.id);
                        return (
                          <div
                            key={project.id}
                            draggable={true}
                            onDragStart={(e) => handleProjectDragStart(e, project.id)}
                            onDragEnd={handleProjectDragEnd}
                            onDragOver={handleProjectDragOver}
                            onDrop={(e) => handleProjectDrop(e, project.id)}
                            className={`group w-full flex items-center justify-between pl-6 pr-2 py-1.5 rounded-md text-sm transition-colors cursor-grab active:cursor-grabbing ${filterProject === project.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                              } ${draggedProject === project.id ? 'opacity-50' : ''}`}
                          >
                            <button
                              onClick={() => setFilterProject(project.id)}
                              className="flex items-center gap-2 flex-1 min-w-0"
                              draggable={false}
                            >
                              <GripVertical className={`h-3 w-3 flex-shrink-0 ${filterProject === project.id ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`} />
                              <div className={`w-3 h-3 rounded-full ${project.color} flex-shrink-0`}></div>
                              <span className="truncate">{project.name}</span>
                            </button>
                            <div className="flex items-center gap-1" draggable={false} onDragStart={(e) => e.preventDefault()}>
                              <span className="text-xs opacity-70">{count}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className={`opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center transition-opacity ${filterProject === project.id
                                      ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                                      : 'hover:bg-muted'
                                      }`}
                                    draggable={false}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => handleEditProject(project)}>
                                    <Pencil className="h-3 w-3 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleMoveProjectToFolder(project.id, null)}>
                                    <ArrowRight className="h-3 w-3 mr-2" />
                                    Sacar de carpeta
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleArchiveProject(project.id)}>
                                    <FolderArchive className="h-3 w-3 mr-2" />
                                    Archivar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Projects without folder */}
                {getProjectsWithoutFolder().map((project) => {
                  const count = getTaskCountByProject(project.id);
                  return (
                    <div
                      key={project.id}
                      draggable={true}
                      onDragStart={(e) => handleProjectDragStart(e, project.id)}
                      onDragEnd={handleProjectDragEnd}
                      onDragOver={handleProjectDragOver}
                      onDrop={(e) => handleProjectDrop(e, project.id)}
                      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors cursor-grab active:cursor-grabbing ${filterProject === project.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                        } ${draggedProject === project.id ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => setFilterProject(project.id)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                        draggable={false}
                      >
                        <GripVertical className={`h-3 w-3 flex-shrink-0 ${filterProject === project.id ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`} />
                        <div className={`w-3 h-3 rounded-full ${project.color} flex-shrink-0`}></div>
                        <span className="truncate">{project.name}</span>
                      </button>
                      <div className="flex items-center gap-1" draggable={false} onDragStart={(e) => e.preventDefault()}>
                        <span className="text-xs opacity-70">{count}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className={`opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center transition-opacity ${filterProject === project.id
                                ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                                : 'hover:bg-muted'
                                }`}
                              draggable={false}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEditProject(project)}>
                              <Pencil className="h-3 w-3 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {folders.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                {folders.map(folder => (
                                  <DropdownMenuItem
                                    key={folder.id}
                                    onClick={() => handleMoveProjectToFolder(project.id, folder.id)}
                                  >
                                    <Folder className={`h-3 w-3 mr-2 ${folder.color.replace('bg-', 'text-')}`} />
                                    Mover a {folder.name}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleArchiveProject(project.id)}>
                              <FolderArchive className="h-3 w-3 mr-2" />
                              Archivar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}

                {/* Archived Projects Section */}
                {archivedProjects.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <FolderArchive className="h-3 w-3" />
                      Archivados
                    </h4>
                    {archivedProjects.map((project) => (
                      <div
                        key={project.id}
                        className="group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-3 h-3 rounded-full ${project.color} opacity-50 flex-shrink-0`}></div>
                          <span className="truncate">{project.name}</span>
                        </div>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleRestoreProject(project.id)}
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-muted transition-opacity"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Restaurar proyecto</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )}
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
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${taskView === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${taskView === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${taskView === 'deleted' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${taskView === 'active' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${taskView === 'archived' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${taskView === 'deleted' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
      <div className="flex-1 flex flex-col min-w-0 gap-3 md:gap-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-muted-foreground">
              {taskView === 'active' && 'Mis Tareas'}
              {taskView === 'archived' && 'Tareas Archivadas'}
              {taskView === 'deleted' && 'Tareas Eliminadas'}
            </h1>
            <p className="text-sm md:text-base font-medium text-foreground">
              {taskView === 'active' && (
                <>
                  {filterProject !== 'all' ? (
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${projects.find(p => p.id === filterProject)?.color || 'bg-gray-500'}`} />
                      {projects.find(p => p.id === filterProject)?.name}
                    </span>
                  ) : 'Todos los proyectos'}
                  <span className="text-muted-foreground font-normal"> · {filteredTasks.length} tareas</span>
                </>
              )}
              {taskView === 'archived' && `${archivedTasks.length} tareas completadas`}
              {taskView === 'deleted' && `${deletedTasks.length} tareas en papelera`}
            </p>
            {/* Project Description */}
            {taskView === 'active' && filterProject !== 'all' && (
              <div className="mt-3">
                {editingProjectDescription ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={projectDescriptionDraft}
                      onChange={(e) => setProjectDescriptionDraft(e.target.value)}
                      placeholder="Objetivos del proyecto..."
                      className="text-sm h-9 max-w-lg"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProjectDescription();
                        if (e.key === 'Escape') setEditingProjectDescription(false);
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-9" onClick={handleSaveProjectDescription}>
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditingProjectDescription(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const currentProject = projects.find(p => p.id === filterProject);
                      setProjectDescriptionDraft(currentProject?.description || '');
                      setEditingProjectDescription(true);
                    }}
                    className="text-sm text-foreground/80 hover:text-foreground flex items-center gap-2 group bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-md transition-colors"
                  >
                    {projects.find(p => p.id === filterProject)?.description || (
                      <span className="italic text-muted-foreground">Click para agregar objetivos del proyecto...</span>
                    )}
                    <Edit className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            )}
            {/* Chat Link - Abrir Grupo WhatsApp */}
            {taskView === 'active' && filterProject !== 'all' && (
              <div className="mt-2 flex items-center gap-2">
                {editingChatLink ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={chatLinkDraft}
                      onChange={(e) => setChatLinkDraft(e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="text-sm h-8 w-80"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveChatLink();
                        if (e.key === 'Escape') setEditingChatLink(false);
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-8" onClick={handleSaveChatLink}>
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingChatLink(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {projects.find(p => p.id === filterProject)?.chatLink ? (
                      <a
                        href={projects.find(p => p.id === filterProject)?.chatLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Abrir grupo
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            const currentProject = projects.find(p => p.id === filterProject);
                            setChatLinkDraft(currentProject?.chatLink || '');
                            setEditingChatLink(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        >
                          <Link className="h-3 w-3" />
                          {projects.find(p => p.id === filterProject)?.chatLink ? 'Editar link' : 'Agregar link de grupo'}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Configurar link de WhatsApp del proyecto</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            )}
            {/* Ads Manager Link */}
            {taskView === 'active' && filterProject !== 'all' && (
              <div className="mt-2 flex items-center gap-2">
                {editingAdsManagerLink ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={adsManagerLinkDraft}
                      onChange={(e) => setAdsManagerLinkDraft(e.target.value)}
                      placeholder="https://adsmanager.facebook.com/..."
                      className="text-sm h-8 w-80"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAdsManagerLink();
                        if (e.key === 'Escape') setEditingAdsManagerLink(false);
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" className="h-8" onClick={handleSaveAdsManagerLink}>
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingAdsManagerLink(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {projects.find(p => p.id === filterProject)?.adsManagerLink ? (
                      <a
                        href={projects.find(p => p.id === filterProject)?.adsManagerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Ads Manager
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            const currentProject = projects.find(p => p.id === filterProject);
                            setAdsManagerLinkDraft(currentProject?.adsManagerLink || '');
                            setEditingAdsManagerLink(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        >
                          <Link className="h-3 w-3" />
                          {projects.find(p => p.id === filterProject)?.adsManagerLink ? 'Editar link' : 'Agregar Ads Manager'}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Configurar link de Ads Manager del cliente</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {taskView === 'active' && (
              <>
                <div className="relative flex-1 md:flex-none">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full md:w-[200px]"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={cycleViewMode} className="flex-shrink-0">
                  {viewMode === 'card' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Nueva Tarea</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Date Filters - Only show in active view */}
        {taskView === 'active' && (
          <div className="flex flex-wrap gap-1.5 md:gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setDateFilter('all')}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap ${dateFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
                }`}
            >
              <LayoutGrid className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span>Todas</span>
              <span className={`px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-xs ${dateFilter === 'all' ? 'bg-primary-foreground/20' : 'bg-background'}`}>
                {dateFilterCounts.all}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap ${dateFilter === 'today'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
                }`}
            >
              <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
              <span className="sm:hidden">Hoy</span>
              <span className={`px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-xs ${dateFilter === 'today' ? 'bg-white/20' : 'bg-blue-200 dark:bg-blue-800'}`}>
                {dateFilterCounts.today}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap ${dateFilter === 'week'
                ? 'bg-purple-500 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300'
                }`}
            >
              <CalendarDays className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">Esta </span><span>Semana</span>
              <span className={`px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-xs ${dateFilter === 'week' ? 'bg-white/20' : 'bg-purple-200 dark:bg-purple-800'}`}>
                {dateFilterCounts.week}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap ${dateFilter === 'month'
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
            >
              <CalendarRange className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">Este </span><span>Mes</span>
              <span className={`px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-xs ${dateFilter === 'month' ? 'bg-white/20' : 'bg-emerald-200 dark:bg-emerald-800'}`}>
                {dateFilterCounts.month}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('overdue')}
              className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm transition-colors whitespace-nowrap ${dateFilter === 'overdue'
                ? 'bg-red-500 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300'
                }`}
            >
              <AlertCircle className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span>Vencidas</span>
              <span className={`px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-xs ${dateFilter === 'overdue' ? 'bg-white/20' : 'bg-red-200 dark:bg-red-800'}`}>
                {dateFilterCounts.overdue}
              </span>
            </button>
          </div>
        )}

        {/* Active Tasks - Kanban Board */}
        {taskView === 'active' && (
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-3 md:gap-4 h-full min-w-max md:min-w-0">
              {DEFAULT_COLUMNS.map((column) => {
                const columnTasks = getTasksByColumn(column.status);
                const StatusIcon = STATUS_ICONS[column.status as keyof typeof STATUS_ICONS] || Circle;

                return (
                  <div
                    key={column.id}
                    className="w-[280px] md:w-[320px] lg:w-[350px] flex-shrink-0 flex flex-col bg-muted/50 rounded-lg p-3 md:p-4"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.status)}
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-3 md:mb-4">
                      <StatusIcon className={`h-4 w-4 md:h-5 md:w-5 ${column.color}`} />
                      <h2 className="font-semibold text-base md:text-lg truncate">
                        {column.name}
                        <span className="ml-2 text-xs md:text-sm text-muted-foreground">
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
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleEdit(task)}
                              className={`p-2 bg-card rounded border-l-4 cursor-pointer hover:shadow transition-all ${draggedTask === task.id ? 'opacity-50' : ''
                                } ${project?.color ? project.color.replace('bg-', 'border-l-') : 'border-l-blue-500'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority].split(' ')[0]}`}></span>
                                <span className="text-sm flex-1 truncate">{task.title}</span>
                                {getUserPhoto(task.assignee) ? (
                                  <img
                                    src={getUserPhoto(task.assignee)}
                                    alt={task.assignee}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                                    {assignee?.initials}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (viewMode === 'list') {
                          // List View
                          return (
                            <div
                              key={task.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleEdit(task)}
                              className={`p-3 bg-card rounded-lg border cursor-pointer hover:shadow transition-all ${draggedTask === task.id ? 'opacity-50' : ''
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleComplete(task);
                                  }}
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${task.status === TaskStatus.DONE
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
                                {getUserPhoto(task.assignee) ? (
                                  <img
                                    src={getUserPhoto(task.assignee)}
                                    alt={task.assignee}
                                    className="w-7 h-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-7 h-7 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                                    {assignee?.initials}
                                  </div>
                                )}
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                          <ContextMenu key={task.id}>
                            <ContextMenuTrigger asChild>
                              <Card
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleEdit(task)}
                                className={`p-3 md:p-4 cursor-pointer hover:shadow-lg transition-all border-l-4 ${draggedTask === task.id ? 'opacity-50 scale-105' : ''
                                  } ${project?.color ? project.color.replace('bg-', 'border-l-') : 'border-l-blue-500'}`}
                              >
                                {/* Task Header */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    {/* Drag Handle */}
                                    <div className="flex-shrink-0 mt-0.5 text-muted-foreground/50 cursor-grab">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <button
                                      draggable={false}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleComplete(task);
                                      }}
                                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${task.status === TaskStatus.DONE
                                        ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                                        : 'border-muted-foreground hover:border-emerald-500 hover:scale-110'
                                        }`}
                                    >
                                      {task.status === TaskStatus.DONE && <CheckCircle2 className="h-3 w-3 animate-in zoom-in duration-200" />}
                                    </button>
                                    <h3 className={`font-semibold text-xs md:text-sm leading-tight break-words transition-all duration-300 ${task.status === TaskStatus.DONE ? 'line-through text-muted-foreground' : ''}`}>
                                      {task.title}
                                    </h3>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0" draggable={false} onDragStart={(e) => e.preventDefault()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      draggable={false}
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
                                      draggable={false}
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
                                      draggable={false}
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
                                      className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]
                                        }`}
                                    >
                                      {task.priority === 'HIGH' ? 'Alta' : task.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                                    </span>
                                    {task.dueDate && (
                                      <span className={`text-xs flex items-center gap-1 ${isOverdue(task.dueDate) && task.status !== TaskStatus.DONE ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                        <Calendar className="h-3 w-3" />
                                        {isOverdue(task.dueDate) && task.status !== TaskStatus.DONE ? (
                                          <span>{getDaysOverdue(task.dueDate)}d vencida</span>
                                        ) : isToday(task.dueDate) ? (
                                          <>Hoy{hasTime(task.dueDate) && ` ${formatTime(task.dueDate)}`}</>
                                        ) : isTomorrow(task.dueDate) ? (
                                          <>Mañana{hasTime(task.dueDate) && ` ${formatTime(task.dueDate)}`}</>
                                        ) : (
                                          <>
                                            {new Date(task.dueDate).toLocaleDateString('es-ES', {
                                              day: '2-digit',
                                              month: 'short',
                                            })}
                                            {hasTime(task.dueDate) && ` ${formatTime(task.dueDate)}`}
                                          </>
                                        )}
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
                                    {getUserPhoto(task.assignee) ? (
                                      <img
                                        src={getUserPhoto(task.assignee)}
                                        alt={task.assignee}
                                        className="w-6 h-6 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                                        {assignee?.initials}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              <ContextMenuItem onClick={() => handleEdit(task)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleDuplicate(task)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicar
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Cambiar estado
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                  <ContextMenuItem
                                    onClick={() => handleQuickStatusChange(task, TaskStatus.TODO)}
                                    disabled={task.status === TaskStatus.TODO}
                                  >
                                    <Circle className="mr-2 h-4 w-4" />
                                    Por hacer
                                    {task.status === TaskStatus.TODO && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleQuickStatusChange(task, TaskStatus.IN_PROGRESS)}
                                    disabled={task.status === TaskStatus.IN_PROGRESS}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    En progreso
                                    {task.status === TaskStatus.IN_PROGRESS && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleQuickStatusChange(task, TaskStatus.DONE)}
                                    disabled={task.status === TaskStatus.DONE}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Completada
                                    {task.status === TaskStatus.DONE && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <Flag className="mr-2 h-4 w-4" />
                                  Cambiar prioridad
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                  <ContextMenuItem
                                    onClick={() => handleQuickPriorityChange(task, Priority.HIGH)}
                                    disabled={task.priority === Priority.HIGH}
                                  >
                                    <span className="mr-2 w-3 h-3 rounded-full bg-red-500" />
                                    Alta
                                    {task.priority === Priority.HIGH && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleQuickPriorityChange(task, Priority.MEDIUM)}
                                    disabled={task.priority === Priority.MEDIUM}
                                  >
                                    <span className="mr-2 w-3 h-3 rounded-full bg-yellow-500" />
                                    Media
                                    {task.priority === Priority.MEDIUM && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleQuickPriorityChange(task, Priority.LOW)}
                                    disabled={task.priority === Priority.LOW}
                                  >
                                    <span className="mr-2 w-3 h-3 rounded-full bg-emerald-500" />
                                    Baja
                                    {task.priority === Priority.LOW && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                  </ContextMenuItem>
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                  Mover a proyecto
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent className="max-h-60 overflow-y-auto">
                                  {projects.map((p) => (
                                    <ContextMenuItem
                                      key={p.id}
                                      onClick={() => handleQuickProjectChange(task, p.id)}
                                      disabled={task.projectId === p.id}
                                    >
                                      <span className={`mr-2 w-3 h-3 rounded-full ${p.color}`} />
                                      {p.name}
                                      {task.projectId === p.id && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                                    </ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => handleAddComment(task)}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Agregar comentario
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => handleToggleComplete(task)}
                                className={task.status === TaskStatus.DONE ? "text-amber-600 focus:text-amber-600" : "text-emerald-600 focus:text-emerald-600"}
                              >
                                {task.status === TaskStatus.DONE ? (
                                  <>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Restaurar tarea
                                  </>
                                ) : (
                                  <>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archivar (completar)
                                  </>
                                )}
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleDelete(task)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
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

              {/* Note Columns - Only show when a specific project is selected */}
              {filterProject !== 'all' && (
                <>
                  {/* Separator between task columns and note columns */}
                  {noteColumns.length > 0 && (
                    <div className="w-px bg-border/50 mx-2 self-stretch flex-shrink-0" />
                  )}

                  {/* Note Columns */}
                  {noteColumns.map((column) => {
                    const columnItems = getNoteItemsForColumn(column.id);

                    return (
                      <NoteColumn
                        key={column.id}
                        column={column}
                        items={columnItems}
                        onEditColumn={handleEditNoteColumn}
                        onDeleteColumn={handleDeleteNoteColumn}
                        onAddItem={handleAddNoteItem}
                        onEditItem={handleEditNoteItem}
                        onDeleteItem={handleDeleteNoteItem}
                        onDropItem={handleNoteItemDrop}
                        onImageClick={(img) => {
                          setSelectedImage(img);
                          setImageModalOpen(true);
                        }}
                        draggedItemId={draggedNoteItem}
                      />
                    );
                  })}

                  {/* Add Note Column Button */}
                  <div className="w-[280px] md:w-[320px] lg:w-[350px] flex-shrink-0">
                    <button
                      onClick={handleAddNoteColumn}
                      className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Plus className="h-6 w-6" />
                      <span className="text-sm font-medium">Agregar columna</span>
                    </button>
                  </div>
                </>
              )}
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
                    <Card key={task.id} className="p-4 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10">
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
                        {getUserPhoto(task.assignee) ? (
                          <img
                            src={getUserPhoto(task.assignee)}
                            alt={task.assignee}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                            {assignee?.initials}
                          </div>
                        )}
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
                    <Card key={task.id} className="p-4 border-destructive/30 bg-red-50/30 dark:bg-red-950/10">
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
                        {getUserPhoto(task.assignee) ? (
                          <img
                            src={getUserPhoto(task.assignee)}
                            alt={task.assignee}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${assignee?.color} flex items-center justify-center text-white text-xs`}>
                            {assignee?.initials}
                          </div>
                        )}
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

              {/* Checklist Section */}
              <div className="space-y-2">
                <Label>Lista de verificación (tipo WhatsApp)</Label>
                <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                  {formData.checklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${item.completed
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground'
                          }`}
                        onClick={() => {
                          const newChecklist = [...formData.checklist];
                          newChecklist[idx] = {
                            ...item,
                            completed: !item.completed,
                            completedAt: !item.completed ? Date.now() : undefined,
                          };
                          setFormData({ ...formData, checklist: newChecklist });
                        }}
                      >
                        {item.completed && <span className="text-white text-xs">✓</span>}
                      </div>
                      <span className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            checklist: formData.checklist.filter((_, i) => i !== idx),
                          });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Agregar item a la lista..."
                      value={checklistInput}
                      onChange={(e) => setChecklistInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && checklistInput.trim()) {
                          e.preventDefault();
                          const newItem: TaskChecklistItem = {
                            id: crypto.randomUUID(),
                            text: checklistInput.trim(),
                            completed: false,
                            createdAt: Date.now(),
                          };
                          setFormData({
                            ...formData,
                            checklist: [...formData.checklist, newItem],
                          });
                          setChecklistInput('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (checklistInput.trim()) {
                          const newItem: TaskChecklistItem = {
                            id: crypto.randomUUID(),
                            text: checklistInput.trim(),
                            completed: false,
                            createdAt: Date.now(),
                          };
                          setFormData({
                            ...formData,
                            checklist: [...formData.checklist, newItem],
                          });
                          setChecklistInput('');
                        }
                      }}
                      disabled={!checklistInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

              {/* Row 3: Dates and Times */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de inicio</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      disabled={isSaving}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      disabled={isSaving || !formData.startDate}
                      className="w-28"
                      placeholder="--:--"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fecha límite</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      disabled={isSaving}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                      disabled={isSaving || !formData.dueDate}
                      className="w-28"
                      placeholder="--:--"
                    />
                  </div>
                </div>
              </div>

              {/* Recurrence Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="recurrence-toggle" className="font-medium">Tarea recurrente</Label>
                  </div>
                  <Switch
                    id="recurrence-toggle"
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                    disabled={isSaving}
                  />
                </div>

                {formData.isRecurring && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Frecuencia</Label>
                      <Select
                        value={formData.recurrenceFrequency}
                        onValueChange={(value) => setFormData({ ...formData, recurrenceFrequency: value as RecurrenceFrequency })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.recurrenceFrequency === 'weekly' && (
                      <div className="space-y-2">
                        <Label>Día de la semana</Label>
                        <Select
                          value={String(formData.recurrenceDayOfWeek)}
                          onValueChange={(value) => setFormData({ ...formData, recurrenceDayOfWeek: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Domingo</SelectItem>
                            <SelectItem value="1">Lunes</SelectItem>
                            <SelectItem value="2">Martes</SelectItem>
                            <SelectItem value="3">Miércoles</SelectItem>
                            <SelectItem value="4">Jueves</SelectItem>
                            <SelectItem value="5">Viernes</SelectItem>
                            <SelectItem value="6">Sábado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.recurrenceFrequency === 'biweekly' && (
                      <div className="space-y-2">
                        <Label>Día de la semana</Label>
                        <Select
                          value={String(formData.recurrenceDayOfWeek)}
                          onValueChange={(value) => setFormData({ ...formData, recurrenceDayOfWeek: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Domingo</SelectItem>
                            <SelectItem value="1">Lunes</SelectItem>
                            <SelectItem value="2">Martes</SelectItem>
                            <SelectItem value="3">Miércoles</SelectItem>
                            <SelectItem value="4">Jueves</SelectItem>
                            <SelectItem value="5">Viernes</SelectItem>
                            <SelectItem value="6">Sábado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.recurrenceFrequency === 'monthly' && (
                      <div className="space-y-2">
                        <Label>Día del mes</Label>
                        <Select
                          value={String(formData.recurrenceDayOfMonth)}
                          onValueChange={(value) => setFormData({ ...formData, recurrenceDayOfMonth: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={String(day)}>
                                Día {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      La tarea se creará automáticamente en la fecha especificada según la frecuencia seleccionada.
                    </p>
                  </div>
                )}
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

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Proyecto</DialogTitle>
            <DialogDescription>Modifica el nombre y color del proyecto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del proyecto</Label>
              <Input
                placeholder="Nombre del proyecto"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-slate-500'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${editProjectColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    onClick={() => setEditProjectColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProjectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditProject}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta'}</DialogTitle>
            <DialogDescription>
              {editingFolder ? 'Modifica el nombre y color de la carpeta' : 'Crea una carpeta para agrupar proyectos relacionados (ej: proyectos del mismo cliente)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la carpeta</Label>
              <Input
                placeholder="Ej: Cliente XYZ"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {['bg-gray-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${newFolderColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    onClick={() => setNewFolderColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsFolderDialogOpen(false);
              setEditingFolder(null);
              setNewFolderName('');
              setNewFolderColor('bg-gray-500');
            }}>
              Cancelar
            </Button>
            <Button onClick={editingFolder ? handleEditFolder : handleCreateFolder}>
              {editingFolder ? 'Guardar' : 'Crear'}
            </Button>
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

      {/* Note Column Modal */}
      <NoteColumnModal
        isOpen={isNoteColumnModalOpen}
        onClose={() => {
          setIsNoteColumnModalOpen(false);
          setEditingNoteColumn(null);
        }}
        onSave={handleSaveNoteColumn}
        editingColumn={editingNoteColumn}
        isSaving={isSavingNote}
      />

      {/* Note Item Modal */}
      <NoteItemModal
        isOpen={isNoteItemModalOpen}
        onClose={() => {
          setIsNoteItemModalOpen(false);
          setEditingNoteItem(null);
          setSelectedNoteColumnId(null);
        }}
        onSave={handleSaveNoteItem}
        editingItem={editingNoteItem}
        columnId={selectedNoteColumnId || ''}
        projectId={filterProject}
        isSaving={isSavingNote}
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
