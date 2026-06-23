import { useState } from 'react';
import { ListTodo } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/auth';
import TodoList from './TodoList';

/**
 * Botón flotante GLOBAL de pendientes (To-Do). Disponible en todas las vistas
 * (montado en MainLayout). Abre un popup con la lista personal del usuario.
 * Se ubica encima del botón de chat (bottom-24) para no solaparse.
 */
export default function GlobalTodo() {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mis pendientes"
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center"
      >
        <ListTodo className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-amber-500" />
              Mis pendientes
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <TodoList />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
