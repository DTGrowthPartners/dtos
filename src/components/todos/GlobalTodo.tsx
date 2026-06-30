import { useState, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListTodo, X, PictureInPicture2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import TodoList from './TodoList';

// ¿El navegador soporta Document Picture-in-Picture? (Chromium 116+)
const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;

// Copia los estilos del documento principal a la ventana PiP (Tailwind + variables CSS).
const copyStyles = (srcDoc: Document, destDoc: Document) => {
  for (const sheet of Array.from(srcDoc.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      const style = destDoc.createElement('style');
      style.textContent = css;
      destDoc.head.appendChild(style);
    } catch {
      const s = sheet as CSSStyleSheet;
      if (s.href) {
        const link = destDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = s.href;
        destDoc.head.appendChild(link);
      }
    }
  }
};

// Contenido de la ventana flotante: la lista completa de pendientes.
function PipContent() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white flex-shrink-0">
        <ListTodo className="h-4 w-4" />
        <span className="font-semibold text-sm">Mis pendientes</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <TodoList />
      </div>
    </div>
  );
}

/**
 * Panel lateral GLOBAL de pendientes (To-Do) + botón para abrirlo como ventana
 * FLOTANTE (Document Picture-in-Picture), que queda encima de todo el navegador
 * y de otras pestañas — al estilo del mini-reproductor de Spotify.
 */
export default function GlobalTodo() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();
  const rootRef = useRef<Root | null>(null);
  const pipWinRef = useRef<Window | null>(null);

  if (!user) return null;

  const openFloating = async () => {
    try {
      if (pipWinRef.current && !pipWinRef.current.closed) {
        pipWinRef.current.focus();
        return;
      }
      // Tamaño inicial: recuerda el último, o uno compacto relativo a la pantalla.
      let w = 300;
      let h = Math.min(500, Math.round((window.screen?.availHeight || 800) * 0.55));
      try {
        const saved = JSON.parse(localStorage.getItem('dtos_todo_pip_size') || 'null');
        if (saved?.w && saved?.h) { w = saved.w; h = saved.h; }
      } catch { /* noop */ }

      const pip: Window = await (window as unknown as {
        documentPictureInPicture: { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
      }).documentPictureInPicture.requestWindow({ width: w, height: h });

      pip.addEventListener('resize', () => {
        try { localStorage.setItem('dtos_todo_pip_size', JSON.stringify({ w: pip.innerWidth, h: pip.innerHeight })); } catch { /* noop */ }
      });

      copyStyles(document, pip.document);
      pip.document.documentElement.className = document.documentElement.className;
      pip.document.body.style.margin = '0';

      const container = pip.document.createElement('div');
      pip.document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<PipContent />);
      rootRef.current = root;
      pipWinRef.current = pip;

      pip.addEventListener('pagehide', () => {
        try { root.unmount(); } catch { /* noop */ }
        rootRef.current = null;
        pipWinRef.current = null;
      });

      setOpen(false);
    } catch (e) {
      console.error('No se pudo abrir el To-Do flotante:', e);
      setOpen(true); // respaldo: panel lateral
    }
  };

  return (
    <>
      {/* Botón ámbar: abre el panel de pendientes */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Mis pendientes"
          style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 5rem)' }}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center"
        >
          <ListTodo className="h-6 w-6" />
        </button>
      )}

      {/* Panel lateral (respaldo cuando no hay soporte PiP) */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[360px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white flex-shrink-0">
            <span className="font-semibold flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Mis pendientes
            </span>
            <div className="flex items-center gap-1">
              {pipSupported() && (
                <button
                  onClick={openFloating}
                  className="h-7 w-7 p-0 rounded hover:bg-white/20 flex items-center justify-center"
                  title="Abrir como ventana flotante (encima de todo el navegador)"
                >
                  <PictureInPicture2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 p-0 rounded hover:bg-white/20 flex items-center justify-center"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <TodoList />
          </div>
        </div>
      )}
    </>
  );
}
