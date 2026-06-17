import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Cog,
  UserCog,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Menu,
  X,
  TrendingUp,
  BookUser,
  LayoutGrid,
  Bot,
  Clock,
  Activity,
  Server,
  FileText,
  FileBarChart,
  Receipt,
  Globe,
  MonitorSmartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuthStore } from '@/lib/auth';

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string; // Permiso requerido para ver este item
  badge?: string; // ej "nuevo"
}

interface NavGroup {
  label: string | null; // null = sin encabezado (Dashboard)
  dotColor?: string;     // color del punto del encabezado
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [{ title: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard' }],
  },
  {
    label: 'Comercial',
    dotColor: 'bg-emerald-500',
    items: [
      { title: 'Ventas', path: '/crm', icon: TrendingUp, permission: 'crm' },
      { title: 'Clientes', path: '/clientes', icon: Users, permission: 'clientes' },
      { title: 'Servicios', path: '/servicios', icon: Briefcase, permission: 'servicios' },
      { title: 'Propuestas', path: '/propuestas', icon: FileText, permission: 'propuestas', badge: 'nuevo' },
    ],
  },
  {
    label: 'Operación',
    dotColor: 'bg-violet-500',
    items: [
      { title: 'Operaciones', path: '/tareas', icon: Cog, permission: 'tareas' },
      { title: 'Equipo', path: '/equipo', icon: UserCog, permission: 'equipo' },
      { title: 'Directorio', path: '/terceros', icon: BookUser, permission: 'terceros' },
      { title: 'Reportes', path: '/reportes', icon: FileBarChart, permission: 'reportes' },
    ],
  },
  {
    label: 'Control',
    dotColor: 'bg-amber-500',
    items: [
      { title: 'Finanzas', path: '/finanzas', icon: DollarSign, permission: 'finanzas' },
      { title: 'Cobros & MRR', path: '/cobros', icon: Receipt, permission: 'cobros', badge: 'nuevo' },
    ],
  },
  {
    label: 'Automatización',
    dotColor: 'bg-pink-500',
    items: [
      { title: 'Agentes', path: '/agentes', icon: Bot, permission: 'agentes' },
      { title: 'Crons', path: '/crons', icon: Clock, permission: 'crons' },
      { title: 'Apps', path: '/apps', icon: LayoutGrid },
    ],
  },
  {
    label: 'Sistema',
    dotColor: 'bg-cyan-500',
    items: [
      { title: 'Procesos', path: '/procesos', icon: Activity, permission: 'procesos' },
      { title: 'VPS', path: '/vps', icon: Server, permission: 'vps' },
      { title: 'Logs', path: '/logs', icon: FileText, permission: 'logs' },
      { title: 'Dominios', path: '/dominios', icon: Globe, permission: 'dominios', badge: 'nuevo' },
      { title: 'Webs', path: '/webs', icon: MonitorSmartphone, permission: 'webs', badge: 'nuevo' },
    ],
  },
];

export function AppSidebar() {
  const { collapsed, mobileOpen, setCollapsed, setMobileOpen } = useSidebar();
  const location = useLocation();
  const { user } = useAuthStore();

  // Filtrar items segun permisos y descartar grupos vacios
  const canSee = (item: NavItem) => {
    if (user?.role === 'admin') return true;
    if (!item.permission) return true;
    return user?.permissions?.includes(item.permission);
  };
  const filteredGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, setMobileOpen]);

  return (
    <>
      {/* Mobile Menu Button - Fixed, always visible and above sidebar */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={cn(
          "lg:hidden fixed top-4 z-[60] p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-lg border border-sidebar-border hover:bg-sidebar-accent transition-all duration-300",
          mobileOpen ? (collapsed ? "left-[4.5rem]" : "left-[16.5rem]") : "left-4"
        )}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base styles
          'fixed left-0 top-0 z-50 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out',
          // Height - ALWAYS 100vh
          'h-screen overflow-hidden',
          // Width responsive
          collapsed ? 'w-16' : 'w-64',
          // Mobile: Hidden by default, visible with mobileOpen
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo DTGP (la foto del usuario ya aparece arriba a la derecha en el header) */}
        <div className="flex h-20 items-center justify-center border-b border-sidebar-border px-3 pt-3">
          <NavLink to="/" className="flex flex-col items-center gap-1 w-full">
            <img
              src="/img/logo.png"
              alt="DT Growth Partners"
              className={cn(
                'object-contain',
                collapsed ? 'h-7 w-auto max-w-[44px]' : 'h-9 w-auto max-w-[180px]'
              )}
            />
            {!collapsed && (
              <span className="text-[10px] text-sidebar-muted tracking-wide">DT-OS · v1.0.0</span>
            )}
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="sidebar-scroll flex flex-col gap-0.5 p-3 overflow-y-auto h-[calc(100vh-9rem)]">
          {filteredGroups.map((group, gi) => (
            <div key={group.label || `group-${gi}`} className={cn(gi > 0 && 'mt-3')}>
              {/* Encabezado de grupo (oculto cuando colapsado o sin label) */}
              {group.label && !collapsed && (
                <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
                  <span className={cn('h-2 w-2 rounded-full', group.dotColor)} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                    {group.label}
                  </span>
                </div>
              )}
              {/* Separador sutil entre grupos cuando esta colapsado */}
              {group.label && collapsed && gi > 0 && (
                <div className="my-2 mx-auto h-px w-6 bg-sidebar-border" />
              )}

              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                const linkContent = (
                  <NavLink
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center px-2 lg:px-2'
                    )}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary-foreground')} />
                    {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                    {!collapsed && item.badge && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium hidden lg:block">
                        {item.title}
                        {item.badge ? ` · ${item.badge}` : ''}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.path}>{linkContent}</div>;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse Button - Desktop only (hidden on mobile) */}
        <div className="hidden lg:block absolute bottom-4 left-0 right-0 px-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent',
              !collapsed && 'justify-start'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Colapsar</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
