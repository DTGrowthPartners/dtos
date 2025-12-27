import { Mail, CheckSquare, Circle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { teamMembers, tasks } from '@/data/mockData';
import { cn } from '@/lib/utils';

const roleConfig = {
  admin: { label: 'Administrador', className: 'bg-primary/10 text-primary border-primary/20' },
  manager: { label: 'Manager', className: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
  specialist: { label: 'Especialista', className: 'bg-success/10 text-success border-success/20' },
  designer: { label: 'Diseñador', className: 'bg-warning/10 text-warning border-warning/20' },
};

const statusConfig = {
  available: { label: 'Disponible', color: 'bg-success' },
  busy: { label: 'Ocupado', color: 'bg-warning' },
  away: { label: 'Ausente', color: 'bg-muted-foreground' },
};

export default function Equipo() {
  const getTasksForMember = (name: string) => tasks.filter((t) => t.assignee === name);
  const getCompletedTasks = (name: string) => getTasksForMember(name).filter((t) => t.status === 'completed').length;
  const getPendingTasks = (name: string) => getTasksForMember(name).filter((t) => t.status !== 'completed').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipo</h1>
          <p className="text-muted-foreground">Gestiona los miembros del equipo y su carga de trabajo</p>
        </div>
        <Button className="w-full md:w-auto">
          <Settings className="h-4 w-4 mr-2" />
          Configuración
        </Button>
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Miembros Activos</p>
          <p className="text-3xl font-bold text-foreground mt-2">{teamMembers.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Tareas Totales</p>
          <p className="text-3xl font-bold text-foreground mt-2">{tasks.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">En Progreso</p>
          <p className="text-3xl font-bold text-foreground mt-2">{tasks.filter((t) => t.status === 'in_progress').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Completadas</p>
          <p className="text-3xl font-bold text-success mt-2">{tasks.filter((t) => t.status === 'completed').length}</p>
        </div>
      </div>

      {/* Team Members */}
      <div className="grid gap-4 md:grid-cols-2">
        {teamMembers.map((member) => {
          const role = roleConfig[member.role];
          const status = statusConfig[member.status];
          const memberTasks = getTasksForMember(member.name);
          const completedCount = getCompletedTasks(member.name);
          const pendingCount = getPendingTasks(member.name);
          const completionRate = memberTasks.length > 0 ? (completedCount / memberTasks.length) * 100 : 0;

          return (
            <div key={member.id} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn('absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card', status.color)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{member.name}</h3>
                      <Badge variant="outline" className={cn('text-xs mt-1', role.className)}>
                        {role.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Circle className={cn('h-2 w-2 fill-current', status.color.replace('bg-', 'text-'))} />
                      <span>{status.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{member.email}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Carga de trabajo</span>
                  <span className="text-sm font-medium text-foreground">{pendingCount} tareas pendientes</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{completedCount} completadas</span>
                  <span>{completionRate.toFixed(0)}% completado</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Ver Tareas
                </Button>
                <Button variant="ghost" size="sm">
                  Perfil
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
