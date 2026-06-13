import { useNavigate } from 'react-router-dom';
import AITaskDialog from '@/components/tasks/AITaskDialog';
import { useAiTaskStore } from '@/lib/aiTaskStore';

/**
 * Instancia global del AITaskDialog, montada una sola vez en el árbol de la app
 * (dentro del Router). Se abre desde el store useAiTaskStore.openPrompt(), que
 * disparan el Dashboard y el Command Palette (Cmd+K).
 *
 * Al parsear, guarda el resultado en el store y navega a /tareas, donde la vista
 * lo consume y pre-llena el formulario de nueva tarea (para elegir proyecto y
 * confirmar antes de guardar).
 */
export default function GlobalAiTaskDialog() {
  const navigate = useNavigate();
  const { promptOpen, closePrompt, setPending } = useAiTaskStore();

  return (
    <AITaskDialog
      open={promptOpen}
      onOpenChange={(open) => {
        if (!open) closePrompt();
      }}
      onParsed={(parsed) => {
        setPending(parsed);
        closePrompt();
        navigate('/tareas');
      }}
    />
  );
}
