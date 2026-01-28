import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { useSidebar } from '@/contexts/SidebarContext';
import { CommandPalette } from '@/components/CommandPalette';
import LiveChat from '@/components/chat/LiveChat';

export function MainLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      {/* Global Command Palette - Ctrl+K */}
      <CommandPalette />

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

      {/* Live Chat */}
      <LiveChat />
    </div>
  );
}
