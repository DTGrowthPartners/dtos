import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Home,
  Users,
  Target,
  Building2,
  Briefcase,
  CheckSquare,
  DollarSign,
  UserCircle,
  Plus,
  LogOut,
  Moon,
  Sun,
  HelpCircle,
  Command,
} from 'lucide-react';
import { authService } from '@/lib/auth';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category: 'navigation' | 'actions' | 'settings';
  keywords?: string[];
}

interface CommandPaletteProps {
  onNewTask?: () => void;
}

export function CommandPalette({ onNewTask }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
  }, [isDark]);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Ir a Dashboard',
      description: 'Panel principal',
      icon: <Home className="h-4 w-4" />,
      shortcut: ['G', 'D'],
      action: () => navigate('/'),
      category: 'navigation',
      keywords: ['inicio', 'home', 'panel'],
    },
    {
      id: 'nav-crm',
      label: 'Ir a CRM',
      description: 'Pipeline de ventas',
      icon: <Target className="h-4 w-4" />,
      shortcut: ['G', 'C'],
      action: () => navigate('/crm'),
      category: 'navigation',
      keywords: ['ventas', 'pipeline', 'prospectos', 'deals'],
    },
    {
      id: 'nav-terceros',
      label: 'Ir a Terceros',
      description: 'Contactos y organizaciones',
      icon: <Users className="h-4 w-4" />,
      shortcut: ['G', 'T'],
      action: () => navigate('/terceros'),
      category: 'navigation',
      keywords: ['contactos', 'personas', 'organizaciones'],
    },
    {
      id: 'nav-clientes',
      label: 'Ir a Clientes',
      description: 'Gestionar clientes',
      icon: <Building2 className="h-4 w-4" />,
      shortcut: ['G', 'L'],
      action: () => navigate('/clientes'),
      category: 'navigation',
      keywords: ['empresas', 'cuentas'],
    },
    {
      id: 'nav-servicios',
      label: 'Ir a Servicios',
      description: 'Catálogo de servicios',
      icon: <Briefcase className="h-4 w-4" />,
      shortcut: ['G', 'S'],
      action: () => navigate('/servicios'),
      category: 'navigation',
      keywords: ['productos', 'ofertas'],
    },
    {
      id: 'nav-tareas',
      label: 'Ir a Tareas',
      description: 'Gestión de tareas',
      icon: <CheckSquare className="h-4 w-4" />,
      shortcut: ['G', 'A'],
      action: () => navigate('/tareas'),
      category: 'navigation',
      keywords: ['tasks', 'pendientes', 'kanban'],
    },
    {
      id: 'nav-finanzas',
      label: 'Ir a Finanzas',
      description: 'Dashboard financiero',
      icon: <DollarSign className="h-4 w-4" />,
      shortcut: ['G', 'F'],
      action: () => navigate('/finanzas'),
      category: 'navigation',
      keywords: ['dinero', 'gastos', 'ingresos', 'cuentas'],
    },
    {
      id: 'nav-equipo',
      label: 'Ir a Equipo',
      description: 'Gestión del equipo',
      icon: <Users className="h-4 w-4" />,
      shortcut: ['G', 'E'],
      action: () => navigate('/equipo'),
      category: 'navigation',
      keywords: ['usuarios', 'miembros', 'team'],
    },
    {
      id: 'nav-perfil',
      label: 'Mi Perfil',
      description: 'Ver y editar perfil',
      icon: <UserCircle className="h-4 w-4" />,
      shortcut: ['G', 'P'],
      action: () => navigate('/perfil'),
      category: 'navigation',
      keywords: ['cuenta', 'usuario', 'configuración'],
    },
    // Actions
    {
      id: 'action-new-task',
      label: 'Nueva Tarea',
      description: 'Crear una nueva tarea',
      icon: <Plus className="h-4 w-4" />,
      shortcut: ['Ctrl', 'N'],
      action: () => {
        if (onNewTask) {
          onNewTask();
        } else {
          navigate('/tareas');
        }
      },
      category: 'actions',
      keywords: ['crear', 'agregar', 'task'],
    },
    // Settings
    {
      id: 'settings-theme-toggle',
      label: isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
      description: 'Alternar modo oscuro/claro',
      icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      shortcut: ['Ctrl', 'Shift', 'L'],
      action: toggleTheme,
      category: 'settings',
      keywords: ['dark', 'light', 'modo', 'apariencia'],
    },
    {
      id: 'settings-logout',
      label: 'Cerrar Sesión',
      description: 'Salir del sistema',
      icon: <LogOut className="h-4 w-4" />,
      action: () => {
        authService.logout();
        navigate('/login');
      },
      category: 'settings',
      keywords: ['salir', 'logout', 'exit'],
    },
    {
      id: 'settings-help',
      label: 'Ayuda y atajos',
      description: 'Ver atajos de teclado',
      icon: <HelpCircle className="h-4 w-4" />,
      shortcut: ['?'],
      action: () => {
        alert('Atajos de teclado:\n\nCtrl+K - Abrir paleta de comandos\nCtrl+N - Nueva tarea\nEscape - Cerrar modal\n\nNavegación:\nG+D - Dashboard\nG+C - CRM\nG+T - Terceros\nG+L - Clientes\nG+S - Servicios\nG+A - Tareas\nG+F - Finanzas');
      },
      category: 'settings',
      keywords: ['shortcuts', 'keyboard', 'atajos', 'teclado'],
    },
  ], [navigate, isDark, toggleTheme, onNewTask]);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const matchLabel = cmd.label.toLowerCase().includes(searchLower);
      const matchDescription = cmd.description?.toLowerCase().includes(searchLower);
      const matchKeywords = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      return matchLabel || matchDescription || matchKeywords;
    });
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      settings: [],
    };

    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  const flatCommands = useMemo(() => [
    ...groupedCommands.actions,
    ...groupedCommands.navigation,
    ...groupedCommands.settings,
  ], [groupedCommands]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open command palette with Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      return;
    }

    // New task with Ctrl+N
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !isOpen) {
      e.preventDefault();
      if (onNewTask) {
        onNewTask();
      } else if (location.pathname === '/tareas') {
        // Trigger new task if on tasks page
        const event = new CustomEvent('newTask');
        window.dispatchEvent(event);
      }
      return;
    }

    // Theme toggle with Ctrl+Shift+L
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (!isOpen) return;

    // Navigation within palette
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
          setIsOpen(false);
          setSearch('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  }, [isOpen, flatCommands, selectedIndex, onNewTask, location.pathname, toggleTheme]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    actions: 'Acciones',
    navigation: 'Navegación',
    settings: 'Configuración',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="command-palette-overlay"
        onClick={() => {
          setIsOpen(false);
          setSearch('');
        }}
      />

      {/* Palette */}
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar comandos, páginas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="command-palette-input border-0 px-0"
          />
          <kbd className="command-palette-kbd hidden sm:inline-flex">Esc</kbd>
        </div>

        {/* Results */}
        <div className="command-palette-results">
          {flatCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron resultados</p>
            </div>
          ) : (
            <>
              {(['actions', 'navigation', 'settings'] as const).map(category => {
                const items = groupedCommands[category];
                if (items.length === 0) return null;

                const startIndex = category === 'actions' ? 0 :
                  category === 'navigation' ? groupedCommands.actions.length :
                  groupedCommands.actions.length + groupedCommands.navigation.length;

                return (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd, idx) => {
                      const globalIndex = startIndex + idx;
                      return (
                        <div
                          key={cmd.id}
                          className={`command-palette-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                          onClick={() => {
                            cmd.action();
                            setIsOpen(false);
                            setSearch('');
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className="command-palette-item-icon">
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <div className="command-palette-shortcut">
                              {cmd.shortcut.map((key, i) => (
                                <kbd key={i} className="command-palette-kbd">
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="command-palette-kbd">↑</kbd>
              <kbd className="command-palette-kbd">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="command-palette-kbd">↵</kbd>
              seleccionar
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="h-3 w-3" />
            <span>DTOS</span>
          </div>
        </div>
      </div>
    </>
  );
}
