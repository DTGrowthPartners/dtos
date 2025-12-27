import { Link } from 'react-router-dom';
import { Users, Target, Plus, FileText, TrendingUp, UserPlus } from 'lucide-react';

const quickActions = [
  { title: 'Nuevo Cliente', icon: UserPlus, path: '/clientes', color: 'bg-primary/10 text-primary' },
  { title: 'Nueva Tarea', icon: Plus, path: '/tareas', color: 'bg-success/10 text-success' },
  { title: 'Ver Campañas', icon: Target, path: '/campanas', color: 'bg-warning/10 text-warning' },
  { title: 'Crear Reporte', icon: FileText, path: '/reportes', color: 'bg-chart-4/10 text-chart-4' },
  { title: 'Ver Clientes', icon: Users, path: '/clientes', color: 'bg-chart-1/10 text-chart-1' },
  { title: 'Finanzas', icon: TrendingUp, path: '/finanzas', color: 'bg-success/10 text-success' },
];

export function QuickAccess() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Acceso Rápido</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            to={action.path}
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-all hover:scale-105 cursor-pointer"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-foreground text-center">{action.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
