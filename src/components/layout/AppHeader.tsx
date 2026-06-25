import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, User, ChevronRight, Moon, Sun, LogOut, Command, Sparkles, Check, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import PushButton from '@/components/layout/PushButton';
import { cn } from '@/lib/utils';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { TEAM_MEMBERS } from '@/types/taskTypes';
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme';

const pathNames: Record<string, string> = {
  '/': 'Dashboard',
  '/crm': 'Ventas',
  '/clientes': 'Clientes',
  '/tareas': 'Operaciones',
  '/mis-tareas': 'Mis Tareas',
  '/servicios': 'Servicios',
  '/reportes': 'Reportes',
  '/equipo': 'Equipo',
  '/terceros': 'Directorio',
  '/productos': 'Productos DT Cloud Hub',
  '/finanzas': 'Finanzas',
  '/agentes': 'Agentes',
  '/crons': 'Crons',
  '/procesos': 'Procesos',
  '/vps': 'VPS Health',
  '/logs': 'Logs',
  '/cobros': 'Cobros & MRR',
  '/propuestas': 'Propuestas',
  '/dominios': 'Dominios',
  '/webs': 'Webs',
  '/apps': 'Centro de Apps',
  '/perfil': 'Mi Perfil',
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const currentPath = pathNames[location.pathname] || 'Dashboard';
  const user = authService.getUser();
  const isMisTareasView = location.pathname === '/mis-tareas';

  // Obtener el rol/cargo del equipo basado en el nombre del usuario
  const teamMember = TEAM_MEMBERS.find(m => m.name.toLowerCase() === user?.firstName?.toLowerCase());
  const userRole = teamMember?.role || user?.role || 'Usuario';

  // Aplica el tema al montar / cuando cambia.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const isDark = theme === 'dark' || theme === 'aurora';

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión exitosamente',
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error al cerrar sesión',
        variant: 'destructive',
      });
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b backdrop-blur px-6",
        isMisTareasView
          ? "border-slate-800/50 bg-[rgb(2,6,23)] supports-[backdrop-filter]:bg-[rgb(2,6,23)]/95"
          : "border-border bg-card dark:bg-slate-900/80 supports-[backdrop-filter]:bg-card/60"
      )}
    >
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <span className={isMisTareasView ? "text-slate-400" : "text-muted-foreground"}>DT-OS</span>
        <ChevronRight className={cn("h-4 w-4", isMisTareasView ? "text-slate-400" : "text-muted-foreground")} />
        <span className={cn("font-medium", isMisTareasView ? "text-slate-200" : "text-foreground")}>{currentPath}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search - Opens Command Palette */}
        <button
          onClick={() => {
            // Trigger Ctrl+K programmatically
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              ctrlKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
          className={cn(
            "hidden md:flex items-center gap-2 w-72 h-9 px-3 rounded-md text-sm transition-colors",
            isMisTareasView
              ? "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className={cn(
            "hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono rounded border",
            isMisTareasView
              ? "bg-slate-700 border-slate-600"
              : "bg-muted border-border"
          )}>
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Theme Selector: Claro / Oscuro / Aurora */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={isMisTareasView ? "text-slate-400 hover:text-slate-200" : "text-muted-foreground hover:text-foreground"}
              title="Tema"
            >
              {theme === 'liquid' ? (
                <Droplets className="h-5 w-5 text-cyan-300" />
              ) : theme === 'aurora' ? (
                <Sparkles className="h-5 w-5 text-violet-400" />
              ) : isDark ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Tema</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {([
              { id: 'light' as Theme, label: 'Claro', icon: <Sun className="mr-2 h-4 w-4" /> },
              { id: 'dark' as Theme, label: 'Oscuro', icon: <Moon className="mr-2 h-4 w-4" /> },
              { id: 'aurora' as Theme, label: 'Aurora', icon: <Sparkles className="mr-2 h-4 w-4 text-violet-500" /> },
              { id: 'liquid' as Theme, label: 'Liquid Glass', icon: <Droplets className="mr-2 h-4 w-4 text-cyan-500" /> },
            ]).map((opt) => (
              <DropdownMenuItem
                key={opt.id}
                className="cursor-pointer"
                onClick={() => setTheme(opt.id)}
              >
                {opt.icon}
                <span className="flex-1">{opt.label}</span>
                {theme === opt.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Activar / probar notificaciones push (PWA) */}
        <PushButton isMisTareasView={isMisTareasView} />

        {/* Notifications */}
        <NotificationsDropdown isMisTareasView={isMisTareasView} />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground overflow-hidden">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className={cn("text-sm font-medium", isMisTareasView ? "text-slate-200" : "")}>
                  {user?.firstName || 'Usuario'} {user?.lastName || ''}
                </span>
                <span className={cn("text-xs", isMisTareasView ? "text-slate-400" : "text-muted-foreground")}>
                  {userRole}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
