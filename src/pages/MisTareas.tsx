import { useState, useEffect } from 'react';
import { ExternalLink, Calendar, AlertCircle, CheckCircle2, Clock, User, Grid3X3, List } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import '@/styles/tarjetas.css';
import '@/styles/mis-tareas-compact.css';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  loadUserTasksFromExternal,
  loadProjectsFromExternal,
  getTaskExternalUrl,
  type ExternalTask,
  type ExternalProject,
} from '@/lib/externalTasksService';
import {
  TaskCard,
  TaskListItem,
  TaskCompactListItem,
  UnifiedTaskList,
} from '@/components/external-tasks';

const STATUS_MAP = {
  TODO: { label: 'Pendiente', icon: Clock, color: 'text-blue-500 bg-blue-100' },
  IN_PROGRESS: { label: 'En Progreso', icon: AlertCircle, color: 'text-yellow-500 bg-yellow-100' },
  DONE: { label: 'Completado', icon: CheckCircle2, color: 'text-green-500 bg-green-100' },
};

const PRIORITY_MAP = {
  LOW: { label: 'Baja', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  MEDIUM: { label: 'Media', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  HIGH: { label: 'Alta', color: 'bg-red-100 text-red-800 border-red-300' },
};

const TEAM_MEMBERS = ['Dairo', 'Stiven', 'Mariana', 'Jose', 'Anderson', 'Edgardo'];

// Columnas para las vistas Kanban
const COLUMNS = [
  { status: 'TODO', name: 'Pendiente', color: 'text-blue-400' },
  { status: 'IN_PROGRESS', name: 'En Progreso', color: 'text-amber-400' },
  { status: 'DONE', name: 'Completadas', color: 'text-emerald-400' },
];

export default function MisTareas() {
  const [tasks, setTasks] = useState<ExternalTask[]>([]);
  const [projects, setProjects] = useState<ExternalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('Edgardo'); // TODO: Get from auth context
  const [viewMode, setViewMode] = useState<'simple' | 'card' | 'list' | 'compact' | 'unified'>('simple');
  const { toast } = useToast();

  useEffect(() => {
    loadTasks();
  }, [userName]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const [tasksData, projectsData] = await Promise.all([
        loadUserTasksFromExternal(userName),
        loadProjectsFromExternal(),
      ]);
      setTasks(tasksData);
      setProjects(projectsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las tareas de task.dtgrowthpartners.com',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getProject = (projectId: string) => {
    return projects.find((p) => p.id === projectId);
  };

  const getTasksByStatus = (status: keyof typeof STATUS_MAP) => {
    return tasks.filter((task) => task.status === status);
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
      case 'unified':
        return 'Unificada';
    }
  };

  const cycleViewMode = () => {
    const modes: Array<typeof viewMode> = ['simple', 'card', 'list', 'compact', 'unified'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  return (
    <div className="dt-dense-container space-y-4 animate-fade-in h-full flex flex-col dark flex-1 p-0 overflow-auto -m-6" style={{ background: 'var(--dt-bg-board)' }}>
      <div className="flex-1 p-[2em] overflow-auto">
        {/* Header */}
        <div className="flex flex-col gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold dt-text-primary">Mis Tareas</h1>
          <p className="text-sm dt-text-secondary break-words">
            Tareas asignadas a ti en{' '}
            <a
              href={getTaskExternalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 transition-colors"
            >
              task.dtgrowthpartners.com
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 dt-text-secondary" />
            <Select value={userName} onValueChange={setUserName}>
              <SelectTrigger className="w-[150px] bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-800 hover:border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                {TEAM_MEMBERS.map((member) => (
                  <SelectItem key={member} value={member} className="focus:bg-slate-700 focus:text-slate-100">
                    {member}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={cycleViewMode}
            className="dt-btn-icon dt-btn-icon--primary whitespace-nowrap"
          >
            {['simple', 'card'].includes(viewMode) ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
            <span className="hidden sm:inline">Vista: {getViewModeLabel()}</span>
            <span className="sm:hidden">{getViewModeLabel()}</span>
          </button>
          <button
            onClick={() => window.open(getTaskExternalUrl(), '_blank')}
            className="dt-btn-icon dt-btn-icon--primary whitespace-nowrap"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Abrir App de Tareas</span>
            <span className="sm:hidden">App Tareas</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-6">
        {Object.entries(STATUS_MAP).map(([status, config]) => {
          const count = getTasksByStatus(status as keyof typeof STATUS_MAP).length;
          const Icon = config.icon;
          return (
            <div key={status} className="dt-summary-card">
              <div className="flex items-center gap-2">
                <div className={`dt-summary-icon ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="dt-summary-count">{count}</p>
                  <p className="dt-summary-label break-words">{config.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tasks Content - Different Views */}
      <div className="flex-1 overflow-hidden" style={{ background: 'var(--dt-bg-board-secondary)' }}>
        {viewMode === 'unified' ? (
          /* Vista Unificada */
          <UnifiedTaskList
            tasks={tasks}
            projects={projects}
            columns={COLUMNS}
          />
        ) : viewMode === 'simple' ? (
          /* Vista Simple (Original) */
          <div className="h-full overflow-y-auto" style={{ background: 'var(--dt-bg-board)' }}>
            <div className="dt-reading-width dt-dense-task-list" style={{ background: 'var(--dt-bg-board)' }}>
              {tasks.length === 0 ? (
                <div className="dt-card p-6">
                  <div className="text-center dt-text-secondary">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No tienes tareas asignadas</p>
                  </div>
                </div>
              ) : (
                tasks.map((task) => {
              const status = STATUS_MAP[task.status as keyof typeof STATUS_MAP];
              const priority = PRIORITY_MAP[task.priority as keyof typeof PRIORITY_MAP];
              const project = getProject(task.projectId);
              const StatusIcon = status?.icon || Clock;

              return (
                <div key={task.id} className="dt-task-item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start gap-2 mb-1">
                        <div className={`p-1 rounded-md ${status?.color || 'bg-gray-100'} flex-shrink-0`}>
                          <StatusIcon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="dt-task-title break-words">{task.title}</h3>
                          {task.description && (
                            <p className="dt-task-description line-clamp-2 break-words">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                
                      {/* Metadata */}
                      <div className="flex flex-wrap gap-1.5 ml-8">
                        {/* Project */}
                        {project && (
                          <span className="dt-project-badge">
                            {project.name}
                          </span>
                        )}
                
                        {/* Priority */}
                        {priority && (
                          <span className={`dt-priority-badge dt-priority-badge--${task.priority.toLowerCase()}`}>
                            {priority.label}
                          </span>
                        )}
                
                        {/* Type */}
                        {task.type && (
                          <span className="dt-badge">
                            {task.type}
                          </span>
                        )}
                
                        {/* Due Date */}
                        {task.dueDate && (
                          <span className="dt-time-pill">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        )}
                
                        {/* Status */}
                        <span className={`dt-status-badge dt-status-badge--${task.status.toLowerCase()}`}>
                          {status?.label || task.status}
                        </span>
                      </div>
                    </div>
                
                    {/* Actions */}
                    <button
                      onClick={() => window.open(getTaskExternalUrl(task.id), '_blank')}
                      className="dt-btn-icon"
                      title="Abrir en sistema externo"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
            </div>
          </div>
        ) : (
          /* Vista Kanban (Card, List, Compact) */
          <div className="h-full overflow-x-auto" style={{ background: 'var(--dt-bg-board)' }}>
            <div className="flex gap-6 h-full min-w-max pb-4" style={{ background: 'var(--dt-bg-board)' }}>
              {COLUMNS.map((column) => {
                const columnTasks = getTasksByStatus(column.status as keyof typeof STATUS_MAP);

                return (
                  <div
                    key={column.status}
                    className="flex-1 min-w-[280px] sm:min-w-[320px] flex flex-col dt-column"
                  >
                    {/* Column Header */}
                    <div className="dt-column-header">
                      <div className="dt-column-title">
                        <div className={`w-3 h-3 rounded-full ${column.color.replace('text-', 'bg-')}`}></div>
                        <span>{column.name}</span>
                      </div>
                      <span className="dt-column-count">
                        ({columnTasks.length})
                      </span>
                    </div>

                    {/* Tasks */}
                    <div className={`${viewMode === 'compact' ? 'space-y-0' : 'space-y-3'} flex-1 overflow-y-auto custom-scrollbar`}>
                      {columnTasks.length === 0 ? (
                        <div className="h-32 border-2 border-dashed rounded-lg flex items-center justify-center dt-text-meta text-sm">
                          Sin tareas
                        </div>
                      ) : (
                        columnTasks.map((task) => {
                          const project = getProject(task.projectId);

                          if (viewMode === 'card') {
                            return (
                              <TaskCard
                                key={task.id}
                                task={task}
                                project={project}
                              />
                            );
                          } else if (viewMode === 'list') {
                            return (
                              <div key={task.id} className="bg-slate-900/50 rounded-lg">
                                <TaskListItem
                                  task={task}
                                  project={project}
                                />
                              </div>
                            );
                          } else {
                            // compact
                            return (
                              <TaskCompactListItem
                                key={task.id}
                                task={task}
                                project={project}
                              />
                            );
                          }
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
    </div>
  </div>
  );
}
