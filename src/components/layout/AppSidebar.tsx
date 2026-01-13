import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  // Target, // Temporalmente no usado
  // CheckSquare, // Temporalmente no usado
  FileText,
  UserCog,
  // Package, // Temporalmente no usado
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Layers,
  Briefcase,
  ClipboardCheck,
  Menu,
  X,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Clientes', path: '/clientes', icon: Users },
  { title: 'Servicios', path: '/servicios', icon: Briefcase },
  // { title: 'Campañas', path: '/campanas', icon: Target }, // Temporalmente oculto
  // { title: 'Tareas', path: '/tareas', icon: CheckSquare }, // Temporalmente oculto
  { title: 'Mis Tareas', path: '/mis-tareas', icon: ClipboardCheck },
  // { title: 'Reportes', path: '/reportes', icon: FileText }, // Temporalmente oculto
  { title: 'Equipo', path: '/equipo', icon: UserCog },
  // { title: 'Productos', path: '/productos', icon: Package }, // Temporalmente oculto
  { title: 'Finanzas', path: '/finanzas', icon: DollarSign },
  { title: 'Proveedores', path: '/proveedores', icon: Building2 },
  { title: 'Cuentas de Cobro', path: '/cuentas-cobro', icon: FileText },
];

export function AppSidebar() {
  const { collapsed, mobileOpen, setCollapsed, setMobileOpen } = useSidebar();
  const location = useLocation();

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
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full lg:w-auto')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary flex-shrink-0">
              <Layers className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold text-sidebar-foreground">DT-OS</span>
                <span className="text-xs text-sidebar-muted">v1.0.0</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3 overflow-y-auto h-[calc(100vh-8rem)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            const linkContent = (
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-2 lg:px-2'
                )}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary-foreground')} />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium hidden lg:block">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.path}>{linkContent}</div>;
          })}
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
