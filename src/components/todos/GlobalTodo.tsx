import { useState, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListTodo, X, Minus } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import TodoList from './TodoList';

// ¿El navegador soporta Document Picture-in-Picture? (Chromium 116+)
const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;

const COLLAPSED = { w: 210, h: 64 };
const sizeKey = 'dtos_todo_pip_size';
const savedExpanded = (): { w: number; h: number } => {
  try {
    const s = JSON.parse(localStorage.getItem(sizeKey) || 'null');
    if (s?.w && s?.h) return s;
  } catch { /* noop */ }
  return { w: 320, h: Math.min(520, Math.round((typeof window !== 'undefined' ? window.screen?.availHeight || 800 : 800) * 0.55)) };
};

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

// App dentro de la ventana flotante: mini (solo botón ámbar) <-> expandida (lista).
function PipApp({ pip }: { pip: Window }) {
  const [expanded, setExpanded] = useState(false);

  const expand = () => {
    setExpanded(true);
    const s = savedExpanded();
    try { pip.resizeTo(s.w, s.h); } catch { /* noop */ }
  };
  const collapse = () => {
    setExpanded(false);
    try { pip.resizeTo(COLLAPSED.w, COLLAPSED.h); } catch { /* noop */ }
  };

  // Guardar el tamaño solo cuando está expandida.
  useEffect(() => {
    const onResize = () => {
      if (expanded) {
        try { localStorage.setItem(sizeKey, JSON.stringify({ w: pip.innerWidth, h: pip.innerHeight })); } catch { /* noop */ }
      }
    };
    pip.addEventListener('resize', onResize);
    return () => pip.removeEventListener('resize', onResize);
  }, [expanded, pip]);

  if (!expanded) {
    return (
      <button
        onClick={expand}
        className="w-screen h-screen flex items-center gap-2 px-4 bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        title="Abrir mis pendientes"
      >
        <ListTodo className="h-6 w-6 flex-shrink-0" />
        <span className="font-semibold">Pendientes</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex items-center justify-between px-3 py-2 bg-amber-500 text-white flex-shrink-0">
        <span className="font-semibold text-sm flex items-center gap-2">
          <ListTodo className="h-4 w-4" /> Mis pendientes
        </span>
        <button onClick={collapse} className="h-7 w-7 rounded hover:bg-white/20 flex items-center justify-center" title="Minimizar">
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <TodoList />
      </div>
    </div>
  );
}

/**
 * To-Do global. Botón ámbar -> abre un MINI flotante (Document Picture-in-Picture)
 * que queda encima de todo el navegador y otras pestañas. Al hacer clic en el mini
 * se EXPANDE a la barra grande con la lista; se puede minimizar de nuevo.
 * En navegadores sin soporte PiP, cae a un panel lateral.
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
      const pip: Window = await (window as unknown as {
        documentPictureInPicture: { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
      }).documentPictureInPicture.requestWindow({ width: COLLAPSED.w, height: COLLAPSED.h });

      copyStyles(document, pip.document);
      pip.document.documentElement.className = document.documentElement.className;
      pip.document.body.style.margin = '0';

      const container = pip.document.createElement('div');
      pip.document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<PipApp pip={pip} />);
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

  const launch = () => {
    if (pipSupported()) openFloating();
    else setOpen(true);
  };

  return (
    <>
      {/* Botón ámbar: abre el mini flotante */}
      {!open && (
        <button
          onClick={launch}
          title="Mis pendientes"
          className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center"
        >
          <ListTodo className="h-6 w-6" />
        </button>
      )}

      {/* Panel lateral (respaldo cuando no hay soporte PiP) */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white flex-shrink-0">
            <span className="font-semibold flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Mis pendientes
            </span>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 p-0 rounded hover:bg-white/20 flex items-center justify-center"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <TodoList />
          </div>
        </div>
      )}
    </>
  );
}
