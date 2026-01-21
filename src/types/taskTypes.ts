export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}

export const DEFAULT_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export type TaskType =
  | 'Estrategia'
  | 'Publicidad / Ads'
  | 'Contenido Orgánico'
  | 'Diseño'
  | 'Video / Multimedia'
  | 'Copywriting'
  | 'Revisión / Control de Calidad'
  | 'Cliente / Reuniones';

export const TASK_TYPES: TaskType[] = [
  'Estrategia',
  'Publicidad / Ads',
  'Contenido Orgánico',
  'Diseño',
  'Video / Multimedia',
  'Copywriting',
  'Revisión / Control de Calidad',
  'Cliente / Reuniones',
];

export type TrackingPreset = 'POMODORO_25' | 'DEEP_50' | 'STRATEGIC_90' | 'SHORT_BREAK' | 'LONG_BREAK';

export const TRACKING_PRESETS: { id: TrackingPreset; label: string; minutes: number }[] = [
  { id: 'POMODORO_25', label: '25 min = Pomodoro', minutes: 25 },
  { id: 'DEEP_50', label: '50 min profundo', minutes: 50 },
  { id: 'STRATEGIC_90', label: '90 min sesión estratégica', minutes: 90 },
  { id: 'SHORT_BREAK', label: 'Pausa corta', minutes: 5 },
  { id: 'LONG_BREAK', label: 'Pausa larga', minutes: 15 },
];

export type TeamMemberName = 'Dairo' | 'Stiven' | 'Mariana' | 'Jose' | 'Anderson' | 'Edgardo';

export interface TeamMember {
  name: TeamMemberName;
  role: string;
  initials: string;
  color: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Dairo', role: 'CEO', initials: 'DA', color: 'bg-purple-500' },
  { name: 'Stiven', role: 'Dev', initials: 'ST', color: 'bg-blue-500' },
  { name: 'Mariana', role: 'Designer', initials: 'MA', color: 'bg-pink-500' },
  { name: 'Jose', role: 'Freelancer', initials: 'JO', color: 'bg-orange-500' },
  { name: 'Anderson', role: 'Freelancer', initials: 'AN', color: 'bg-teal-500' },
  { name: 'Edgardo', role: 'Dev', initials: 'EM', color: 'bg-blue-500' },
];

export interface ProjectFolder {
  id: string;
  name: string;
  color: string;
  order?: number;
  expanded?: boolean; // Whether folder is expanded in UI
}

export interface Project {
  id: string;
  name: string;
  color: string;
  order?: number;
  description?: string;
  chatLink?: string; // Link al grupo de WhatsApp u otro canal de comunicacion
  archived?: boolean;
  folderId?: string; // ID of parent folder (for grouping projects)
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
  isDefault?: boolean;
  createdAt: number;
  status: string;
}

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'p1', name: 'Equilibrio Clinic', color: 'bg-indigo-500' },
  { id: 'p2', name: 'E-commerce V1', color: 'bg-rose-500' },
  { id: 'p3', name: 'Interno', color: 'bg-slate-500' },
];

export const DEFAULT_COLUMNS: BoardColumn[] = [
  {
    id: 'col-todo',
    name: 'Tarea',
    color: 'text-blue-400',
    icon: 'Circle',
    order: 0,
    isDefault: true,
    createdAt: Date.now(),
    status: TaskStatus.TODO
  },
  {
    id: 'col-in-progress',
    name: 'En curso',
    color: 'text-amber-400',
    icon: 'Clock',
    order: 1,
    isDefault: true,
    createdAt: Date.now(),
    status: TaskStatus.IN_PROGRESS
  },
  {
    id: 'col-done',
    name: 'Terminada',
    color: 'text-emerald-400',
    icon: 'CheckCircle2',
    order: 2,
    isDefault: true,
    createdAt: Date.now(),
    status: TaskStatus.DONE
  }
];

export interface TaskComment {
  id: string;
  text: string;
  author: TeamMemberName;
  createdAt: number;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  assignee: TeamMemberName;
  creator: TeamMemberName;
  projectId: string;
  type?: TaskType;
  trackingPreset?: TrackingPreset;
  createdAt: number;
  startDate?: number;
  dueDate?: number;
  completedAt?: number;
  originalId?: string;
  images?: string[];
  comments?: TaskComment[];
  pomodoroSessions?: PomodoroSession[];
  totalPomodoros?: number;
  currentPomodoroTime?: number;
  pomodoroStatus?: 'idle' | 'running' | 'paused' | 'break';
  deletedAt?: number;
  // Recurrence fields
  recurrence?: RecurrenceConfig;
  isRecurringInstance?: boolean; // true if this task was generated from a recurring template
  recurringTemplateId?: string; // ID of the original recurring task template
  // Checklist/subtasks fields
  checklist?: TaskChecklistItem[];
}

export interface PomodoroSession {
  id: string;
  taskId: string;
  startTime: number;
  endTime: number;
  duration: number;
  completed: boolean;
  type: 'work' | 'break';
  date: string;
}

export interface PomodoroConfig {
  workDuration: number;
  shortBreak: number;
  longBreak: number;
  autoStartBreak: boolean;
  soundEnabled: boolean;
}

// Recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  nextOccurrence?: number; // timestamp of next occurrence
  lastGenerated?: number; // timestamp when last task was generated
}

export const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
];

export type NewTask = Omit<Task, 'id' | 'createdAt'>;
export type NewProject = Omit<Project, 'id'>;

export interface DragItem {
  id: string;
  columnId: string;
}

export type NewColumn = Omit<BoardColumn, 'id' | 'createdAt'>;
