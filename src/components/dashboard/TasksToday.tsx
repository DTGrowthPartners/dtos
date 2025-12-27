import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { tasks } from '@/data/mockData';
import { cn } from '@/lib/utils';

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  medium: { label: 'Media', className: 'bg-warning/10 text-warning border-warning/20' },
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground border-muted' },
};

const statusIcons = {
  todo: Clock,
  in_progress: AlertCircle,
  review: AlertCircle,
  completed: CheckCircle2,
};

export function TasksToday() {
  const todayTasks = tasks
    .filter((task) => task.status !== 'completed')
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Tareas de Hoy</h3>
        <Badge variant="secondary" className="font-medium">
          {todayTasks.length} pendientes
        </Badge>
      </div>
      
      <div className="space-y-3">
        {todayTasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          const priority = priorityConfig[task.priority];
          
          return (
            <div
              key={task.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <StatusIcon
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  task.status === 'in_progress' && 'text-primary',
                  task.status === 'review' && 'text-warning',
                  task.status === 'todo' && 'text-muted-foreground'
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.client && `${task.client} • `}
                  {task.assignee}
                </p>
              </div>
              <Badge variant="outline" className={cn('text-xs', priority.className)}>
                {priority.label}
              </Badge>
            </div>
          );
        })}
      </div>
      
      <button className="w-full mt-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
        Ver todas las tareas →
      </button>
    </div>
  );
}
