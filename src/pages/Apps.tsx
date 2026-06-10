import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  ExternalLink,
  DollarSign,
  Users,
  CheckSquare,
  TrendingUp,
  UsersRound,
  Briefcase,
  Package,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

interface AppItem {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  iconColor: string;
  bgColor: string;
  permission?: string;
}

const APPS: AppItem[] = [
  {
    title: 'Finanzas',
    description: 'Gestión financiera, presupuestos, ingresos y gastos en tiempo real.',
    path: '/finanzas',
    icon: DollarSign,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    permission: 'finanzas',
  },
  {
    title: 'Ventas',
    description: 'Pipeline comercial y seguimiento de oportunidades.',
    path: '/crm',
    icon: TrendingUp,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    permission: 'crm',
  },
  {
    title: 'Tareas',
    description: 'Tablero de tareas y proyectos del equipo.',
    path: '/tareas',
    icon: CheckSquare,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    permission: 'tareas',
  },
  {
    title: 'Clientes',
    description: 'Directorio de clientes, facturación y servicios contratados.',
    path: '/clientes',
    icon: Users,
    iconColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    permission: 'clientes',
  },
  {
    title: 'Servicios',
    description: 'Catálogo de servicios y portafolio de productos.',
    path: '/servicios',
    icon: Briefcase,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    permission: 'servicios',
  },
  {
    title: 'Terceros',
    description: 'Proveedores, empleados, freelancers y prospectos.',
    path: '/terceros',
    icon: UsersRound,
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    permission: 'terceros',
  },
  {
    title: 'Productos',
    description: 'DT Cloud Hub: catálogo de productos digitales.',
    path: '/productos',
    icon: Package,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    permission: 'productos',
  },
];

export default function Apps() {
  const { user } = useAuthStore();

  const canSee = (permission?: string) => {
    if (!permission) return true;
    if (user?.role === 'admin') return true;
    return user?.permissions?.includes(permission) ?? false;
  };

  const visibleApps = APPS.filter((a) => canSee(a.permission));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Apps</h1>
          <p className="text-muted-foreground">
            Accede a las herramientas internas y sistemas creados por DTGP.
          </p>
        </div>
      </div>

      {/* Grid de Apps */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleApps.map((app) => {
          const Icon = app.icon;
          const card = (
            <div className="group h-full rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${app.bgColor}`}>
                  <Icon className={`h-6 w-6 ${app.iconColor}`} />
                </div>
                {app.external && (
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <h3 className="font-semibold text-foreground mb-1">{app.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{app.description}</p>
            </div>
          );

          if (app.external) {
            return (
              <a key={app.title} href={app.path} target="_blank" rel="noopener noreferrer">
                {card}
              </a>
            );
          }
          return (
            <Link key={app.title} to={app.path} className="block h-full">
              {card}
            </Link>
          );
        })}
      </div>

      {visibleApps.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No tienes apps habilitadas. Contacta al administrador.
          </p>
        </div>
      )}
    </div>
  );
}
