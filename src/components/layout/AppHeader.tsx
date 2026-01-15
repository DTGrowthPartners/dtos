import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, User, ChevronRight, Moon, Sun, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { cn } from '@/lib/utils';
import { authService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { TEAM_MEMBERS } from '@/types/taskTypes';

const pathNames: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Gestión de Clientes',
  '/campanas': 'Campañas Meta Ads',
  '/tareas': 'Tareas & Proyectos',
  '/mis-tareas': 'Mis Tareas',
  '/reportes': 'Reportes',
  '/equipo': 'Equipo',
  '/productos': 'Productos DT Cloud Hub',
  '/finanzas': 'Finanzas',
  '/perfil': 'Mi Perfil',
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDark, setIsDark] = useState(false);
  const currentPath = pathNames[location.pathname] || 'Dashboard';
  const user = authService.getUser();
  const isMisTareasView = location.pathname === '/mis-tareas';

  // Obtener el rol/cargo del equipo basado en el nombre del usuario
  const teamMember = TEAM_MEMBERS.find(m => m.name.toLowerCase() === user?.firstName?.toLowerCase());
  const userRole = teamMember?.role || user?.role || 'Usuario';

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

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
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isMisTareasView ? "text-slate-500" : "text-muted-foreground")} />
          <Input
            placeholder="Buscar clientes, tareas, campañas..."
            className={cn(
              "w-72 pl-9 border-0 focus-visible:ring-1 focus-visible:ring-primary",
              isMisTareasView
                ? "bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                : "bg-muted/50"
            )}
          />
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className={isMisTareasView ? "text-slate-400 hover:text-slate-200" : "text-muted-foreground hover:text-foreground"}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

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
                  {user?.firstName || 'Usuario'}
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
