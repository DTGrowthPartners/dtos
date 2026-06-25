import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { useSidebar } from '@/contexts/SidebarContext';
import { CommandPalette } from '@/components/CommandPalette';
import GlobalAiTaskDialog from '@/components/tasks/GlobalAiTaskDialog';
import LiveChat from '@/components/chat/LiveChat';
import GlobalTodo from '@/components/todos/GlobalTodo';
import LiquidBackground from '@/components/theme/LiquidBackground';

export function MainLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="app-shell min-h-screen bg-background">
      {/* Video de fondo (solo tema Liquid Glass) */}
      <LiquidBackground />
      {/* Global Command Palette - Ctrl+K */}
      <CommandPalette />

      {/* Dialog global "Crear tarea con IA" (disparado desde Dashboard y Cmd+K) */}
      <GlobalAiTaskDialog />

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

      {/* Pendientes (To-Do) global */}
      <GlobalTodo />

      {/* Live Chat */}
      <LiveChat />
    </div>
  );
}
