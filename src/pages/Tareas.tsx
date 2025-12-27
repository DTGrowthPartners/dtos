import { useState } from 'react';
import { Plus, Search, Calendar, User, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { tasks, Task, teamMembers } from '@/data/mockData';
import { cn } from '@/lib/utils';

const columns = [
  { id: 'todo', title: 'Por Hacer', color: 'bg-muted' },
  { id: 'in_progress', title: 'En Proceso', color: 'bg-primary/10' },
  { id: 'review', title: 'Revisión', color: 'bg-warning/10' },
  { id: 'completed', title: 'Completado', color: 'bg-success/10' },
];

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-destructive/10 text-destructive border-destructive/20', dot: 'bg-destructive' },
  medium: { label: 'Media', className: 'bg-warning/10 text-warning border-warning/20', dot: 'bg-warning' },
  low: { label: 'Baja', className: 'bg-muted text-muted-foreground border-muted', dot: 'bg-muted-foreground' },
};

export default function Tareas() {
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssignee = assigneeFilter === 'all' || task.assignee === assigneeFilter;
    return matchesSearch && matchesAssignee;
  });

  const getTasksByStatus = (status: string) => filteredTasks.filter((task) => task.status === status);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tareas & Proyectos</h1>
          <p className="text-muted-foreground">Gestiona el flujo de trabajo del equipo</p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tareas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={assigneeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssigneeFilter('all')}
            className={cn(assigneeFilter !== 'all' && 'bg-card')}
          >
            Todos
          </Button>
          {teamMembers.map((member) => (
            <Button
              key={member.id}
              variant={assigneeFilter === member.name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAssigneeFilter(member.name)}
              className={cn(assigneeFilter !== member.name && 'bg-card')}
            >
              {member.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((column) => (
          <div key={column.id} className="kanban-column">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn('h-3 w-3 rounded-full', column.color.replace('/10', ''))} />
                <h3 className="font-semibold text-foreground">{column.title}</h3>
              </div>
              <Badge variant="secondary" className="font-medium">
                {getTasksByStatus(column.id).length}
              </Badge>
            </div>
            <div className="space-y-3">
              {getTasksByStatus(column.id).map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {getTasksByStatus(column.id).length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <p className="text-sm">Sin tareas</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const priority = priorityConfig[task.priority];
  const assignee = teamMembers.find((m) => m.name === task.assignee);

  return (
    <div className="kanban-card group">
      <div className="flex items-start justify-between mb-2">
        <div className={cn('h-2 w-2 rounded-full mt-1.5', priority.dot)} />
        <Badge variant="outline" className={cn('text-xs', priority.className)}>
          {priority.label}
        </Badge>
      </div>
      
      <h4 className="font-medium text-foreground text-sm mb-2 line-clamp-2">{task.title}</h4>
      
      {task.client && (
        <p className="text-xs text-muted-foreground mb-3">{task.client}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {task.assignee.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{task.assignee}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
    </div>
  );
}
