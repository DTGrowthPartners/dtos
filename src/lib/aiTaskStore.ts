import { create } from 'zustand';
import type { ParsedTask } from '@/components/tasks/AITaskDialog';

/**
 * Store global para el flujo "Crear tarea con IA" disponible desde cualquier
 * lugar (Dashboard, Command Palette / Cmd+K, etc.).
 *
 * Flujo:
 * 1. openPrompt() abre el GlobalAiTaskDialog (textarea + parse IA).
 * 2. Al parsear, se guarda el resultado en `pending` y se navega a /tareas.
 * 3. La vista Tareas consume `pending` (consumePending) y pre-llena el form
 *    de nueva tarea para que el usuario revise/elija proyecto y guarde.
 */
interface AiTaskState {
  promptOpen: boolean;
  pending: ParsedTask | null;
  openPrompt: () => void;
  closePrompt: () => void;
  setPending: (p: ParsedTask) => void;
  consumePending: () => ParsedTask | null;
}

export const useAiTaskStore = create<AiTaskState>((set, get) => ({
  promptOpen: false,
  pending: null,
  openPrompt: () => set({ promptOpen: true }),
  closePrompt: () => set({ promptOpen: false }),
  setPending: (p) => set({ pending: p }),
  consumePending: () => {
    const p = get().pending;
    if (p) set({ pending: null });
    return p;
  },
}));
