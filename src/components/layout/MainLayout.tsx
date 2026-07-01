import { Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { useSidebar } from '@/contexts/SidebarContext';
import LiquidBackground from '@/components/theme/LiquidBackground';
// El chat se carga junto con la app (no diferido) para que esté listo y notifique rápido.
import LiveChat from '@/components/chat/LiveChat';

// Otros widgets globales se difieren para no bloquear la primera carga de la página.
const CommandPalette = lazy(() => import('@/components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const GlobalAiTaskDialog = lazy(() => import('@/components/tasks/GlobalAiTaskDialog'));
const GlobalTodo = lazy(() => import('@/components/todos/GlobalTodo'));

export function MainLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="app-shell min-h-screen bg-background">
      {/* Video de fondo (solo tema Liquid Glass) */}
      <LiquidBackground />
      <Suspense fallback={null}>
        {/* Global Command Palette - Ctrl+K */}
        <CommandPalette />
        {/* Dialog global "Crear tarea con IA" (disparado desde Dashboard y Cmd+K) */}
        <GlobalAiTaskDialog />
      </Suspense>

      <AppSidebar />
      <div
        className={cn(
          "transition-all duration-300 flex flex-col min-h-screen",
          // Mobile: no padding (sidebar is overlay)
          // Desktop: padding based on collapsed state
          "pl-0 lg:pl-16",
          !collapsed && "lg:pl-64"
        )}
      >
        <AppHeader />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
        <AppFooter />
      </div>

      {/* Live Chat (cargado con la app) */}
      <LiveChat />

      {/* Pendientes (To-Do) global — diferido */}
      <Suspense fallback={null}>
        <GlobalTodo />
      </Suspense>
    </div>
  );
}
