import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { loadTasks } from '@/lib/firestoreTaskService';
import { useAuthStore } from '@/lib/auth';
import { TEAM_MEMBERS, type Task, type TeamMemberName } from '@/types/taskTypes';
import { Link } from 'react-router-dom';

const priorityConfig = {
  HIGH: { label: 'Alta', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  MEDIUM: { label: 'Media', className: 'bg-warning/10 text-warning border-warning/20' },
  LOW: { label: 'Baja', className: 'bg-muted text-muted-foreground border-muted' },
};

const statusIcons = {
  TODO: Clock,
  IN_PROGRESS: AlertCircle,
  DONE: CheckCircle2,
};

export function TasksToday() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  // Map user firstName to team member name
  const getTeamMemberNameFromUser = (firstName: string | undefined): TeamMemberName | undefined => {
    if (!firstName) return undefined;
    const normalizedName = firstName.toLowerCase().trim();
    const member = TEAM_MEMBERS.find(m => m.name.toLowerCase() === normalizedName);
    return member?.name;
  };

  const loggedUserName = getTeamMemberNameFromUser(user?.firstName);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        const tasksData = await loadTasks();
        setTasks(tasksData);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Filter tasks for current user and not completed
  const todayTasks = tasks
    .filter((task) => {
      const isUserTask = loggedUserName
        ? (task.assignee === loggedUserName || task.creator === loggedUserName)
        : true;
      return isUserTask && task.status !== 'DONE';
    })
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Tareas de Hoy</h3>
        </div>
        <div className="text-center text-muted-foreground py-4">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Tareas Pendientes</h3>
        <Badge variant="secondary" className="font-medium">
          {todayTasks.length} pendientes
        </Badge>
      </div>

      <div className="space-y-3">
        {todayTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No tienes tareas pendientes
          </div>
        ) : (
          todayTasks.map((task) => {
            const StatusIcon = statusIcons[task.status as keyof typeof statusIcons] || Clock;
            const priority = priorityConfig[task.priority as keyof typeof priorityConfig];

            return (
              <div
                key={task.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <StatusIcon
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    task.status === 'IN_PROGRESS' && 'text-primary',
                    task.status === 'TODO' && 'text-muted-foreground'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.assignee}
                  </p>
                </div>
                {priority && (
                  <Badge variant="outline" className={cn('text-xs', priority.className)}>
                    {priority.label}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>

      <Link to="/tareas" className="block w-full mt-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors text-center">
        Ver todas las tareas →
      </Link>
    </div>
  );
}
