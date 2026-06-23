import { useState } from 'react';
import { ListTodo, X } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import TodoList from './TodoList';

/**
 * Panel lateral GLOBAL de pendientes (To-Do). Disponible en todas las vistas
 * (montado en MainLayout). A diferencia de un modal, NO bloquea la pantalla:
 * se puede dejar abierto a la derecha mientras se trabaja en otras vistas.
 * Mismo estilo que el chat (LiveChat).
 */
export default function GlobalTodo() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <>
      {/* Botón flotante (se oculta cuando el panel está abierto) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Mis pendientes"
          className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center"
        >
          <ListTodo className="h-6 w-6" />
        </button>
      )}

      {/* Panel lateral (no-modal): no usa overlay, deja interactuar con la app */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[360px] bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
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

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-4">
            <TodoList />
          </div>
        </div>
      )}
    </>
  );
}
