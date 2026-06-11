import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  ExternalLink,
  DollarSign,
  Users,
  Cog,
  TrendingUp,
  BookUser,
  Briefcase,
  Package,
  BarChart3,
  MessageSquare,
  PenSquare,
  Sparkles,
  CheckSquare,
  UtensilsCrossed,
  Bot,
  Search,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

type AppCategory = 'internal' | 'external';

interface AppItem {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  iconColor: string;
  bgColor: string;
  permission?: string;
  category: AppCategory;
}

const APPS: AppItem[] = [
  // ============= Apps internas (DTOS) =============
  {
    title: 'Ventas',
    description: 'Pipeline comercial y seguimiento de oportunidades.',
    path: '/crm',
    icon: TrendingUp,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    permission: 'crm',
    category: 'internal',
  },
  {
    title: 'Clientes',
    description: 'Directorio de clientes, facturación y servicios contratados.',
    path: '/clientes',
    icon: Users,
    iconColor: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    permission: 'clientes',
    category: 'internal',
  },
  {
    title: 'Servicios',
    description: 'Catálogo de servicios y portafolio de la empresa.',
    path: '/servicios',
    icon: Briefcase,
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    permission: 'servicios',
    category: 'internal',
  },
  {
    title: 'Operaciones',
    description: 'Tablero de proyectos y tareas operativas del equipo.',
    path: '/tareas',
    icon: Cog,
    iconColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    permission: 'tareas',
    category: 'internal',
  },
  {
    title: 'Directorio',
    description: 'Proveedores, empleados, freelancers y prospectos.',
    path: '/terceros',
    icon: BookUser,
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    permission: 'terceros',
    category: 'internal',
  },
  {
    title: 'Finanzas',
    description: 'Gestión financiera, presupuestos, ingresos y gastos en tiempo real.',
    path: '/finanzas',
    icon: DollarSign,
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    permission: 'finanzas',
    category: 'internal',
  },
  {
    title: 'Productos',
    description: 'DT Cloud Hub: catálogo de productos digitales.',
    path: '/productos',
    icon: Package,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    permission: 'productos',
    category: 'internal',
  },

  // ============= Apps externas (otros sistemas de DTGP) =============
  {
    title: 'MetaSuite',
    description: 'Dashboard de campañas y métricas de Meta Ads.',
    path: 'https://metasuite.dtgrowthpartners.com',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
    external: true,
    category: 'external',
  },
  {
    title: 'Chatwoot',
    description: 'Atención al cliente omnicanal: WhatsApp, IG, FB Messenger.',
    path: 'https://chatwoot.dtgrowthpartners.com',
    icon: MessageSquare,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-600/10',
    external: true,
    category: 'external',
  },
  {
    title: 'Draw',
    description: 'Editor de diagramas y wireframes (drawio).',
    path: 'https://draw.dtgrowthpartners.com',
    icon: PenSquare,
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    external: true,
    category: 'external',
  },
  {
    title: 'Stories',
    description: 'Generador de stories y piezas gráficas para clientes.',
    path: 'https://stories.dtgrowthpartners.com',
    icon: Sparkles,
    iconColor: 'text-fuchsia-500',
    bgColor: 'bg-fuchsia-500/10',
    external: true,
    category: 'external',
  },
  {
    title: 'TaskApp',
    description: 'Sistema de tareas legacy (previo a Operaciones).',
    path: 'https://task.dtgrowthpartners.com',
    icon: CheckSquare,
    iconColor: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    external: true,
    category: 'external',
  },
  {
    title: 'CantinaBot',
    description: 'Bot conversacional para La Cantina (pedidos y reservas).',
    path: 'https://cantinabot.dtgrowthpartners.com',
    icon: UtensilsCrossed,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    external: true,
    category: 'external',
  },
  {
    title: 'David Bot',
    description: 'Asistente conversacional David.',
    path: 'https://david.dtgrowthpartners.com',
    icon: Bot,
    iconColor: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    external: true,
    category: 'external',
  },
  {
    title: 'Buscar',
    description: 'NegociosXCiudad: buscador y radar de leads por ciudad.',
    path: 'https://buscar.dtgrowthpartners.com',
    icon: Search,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-600/10',
    external: true,
    category: 'external',
  },
];

function AppCard({ app }: { app: AppItem }) {
  const Icon = app.icon;
  const inner = (
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
      <a href={app.path} target="_blank" rel="noopener noreferrer" className="block h-full">
        {inner}
      </a>
    );
  }
  return (
    <Link to={app.path} className="block h-full">
      {inner}
    </Link>
  );
}

export default function Apps() {
  const { user } = useAuthStore();

  const canSee = (permission?: string) => {
    if (!permission) return true;
    if (user?.role === 'admin') return true;
    return user?.permissions?.includes(permission) ?? false;
  };

  const visibleApps = APPS.filter((a) => canSee(a.permission));
  const internalApps = visibleApps.filter((a) => a.category === 'internal');
  const externalApps = visibleApps.filter((a) => a.category === 'external');

  return (
    <div className="space-y-10 animate-fade-in">
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

      {/* Sección: Apps internas (DTOS) */}
      {internalApps.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              DTOS
            </h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{internalApps.length}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {internalApps.map((app) => (
              <AppCard key={app.title} app={app} />
            ))}
          </div>
        </section>
      )}

      {/* Sección: Otras herramientas DTGP */}
      {externalApps.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Otras herramientas DTGP
            </h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{externalApps.length}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {externalApps.map((app) => (
              <AppCard key={app.title} app={app} />
            ))}
          </div>
        </section>
      )}

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
