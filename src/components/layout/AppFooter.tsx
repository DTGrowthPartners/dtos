import { Circle } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card px-6 py-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>DT-OS v1.0.0</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">© 2024 DT Growth Partners</span>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Soporte</a>
          <span>•</span>
          <a href="#" className="hover:text-foreground transition-colors">Documentación</a>
          <span>•</span>
          <div className="flex items-center gap-2">
            <Circle className="h-2 w-2 fill-success text-success" />
            <span>Sistema operativo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
