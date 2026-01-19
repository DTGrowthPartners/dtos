import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Cola en memoria para tareas de alta prioridad (el chatbot las consume)
// En producción podrías usar Redis o la base de datos
interface WhatsAppTask {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  asignado: string;
  creador: string;
  proyecto: string;
  fechaLimite: string | null;
  creadoEn: string;
}

const pendingHighPriorityTasks: WhatsAppTask[] = [];

// ==================== Endpoints para el Chatbot de WhatsApp ====================

/**
 * GET /api/webhook/whatsapp/tasks
 *
 * Endpoint PÚBLICO para que el chatbot consulte tareas de alta prioridad pendientes.
 * Retorna las tareas y las elimina de la cola (una vez enviadas al WhatsApp).
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 2,
 *   "tasks": [
 *     {
 *       "id": "abc123",
 *       "titulo": "Revisar documento urgente",
 *       "descripcion": "Necesita revision antes de las 5pm",
 *       "prioridad": "Alta",
 *       "asignado": "Stiven",
 *       "creador": "Dairo",
 *       "proyecto": "DT Growth",
 *       "fechaLimite": "2024-01-20",
 *       "creadoEn": "2024-01-19T15:30:00.000Z"
 *     }
 *   ]
 * }
 */
router.get('/whatsapp/tasks', (req: Request, res: Response) => {
  // Obtener todas las tareas pendientes
  const tasks = [...pendingHighPriorityTasks];

  // Limpiar la cola (las tareas ya fueron "consumidas")
  pendingHighPriorityTasks.length = 0;

  res.json({
    success: true,
    count: tasks.length,
    tasks,
  });
});

/**
 * GET /api/webhook/whatsapp/tasks/peek
 *
 * Ver tareas pendientes SIN consumirlas (para debug/testing)
 */
router.get('/whatsapp/tasks/peek', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: pendingHighPriorityTasks.length,
    tasks: pendingHighPriorityTasks,
  });
});

// ==================== Endpoint Interno (requiere auth) ====================

/**
 * POST /api/webhook/whatsapp/tasks
 *
 * Endpoint PROTEGIDO para agregar una tarea de alta prioridad a la cola.
 * Llamado desde el frontend cuando se crea una tarea con prioridad alta.
 *
 * Body:
 * {
 *   "id": "task-id-123",
 *   "titulo": "Nombre de la tarea",
 *   "descripcion": "Descripcion opcional",
 *   "prioridad": "Alta",
 *   "asignado": "Stiven",
 *   "creador": "Dairo",
 *   "proyecto": "Nombre del proyecto",
 *   "fechaLimite": "2024-01-20" // opcional
 * }
 */
router.post('/whatsapp/tasks', authMiddleware, (req: Request, res: Response) => {
  const { id, titulo, descripcion, prioridad, asignado, creador, proyecto, fechaLimite } = req.body;

  // Validar campos requeridos
  if (!titulo || !prioridad || !asignado || !creador) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos: titulo, prioridad, asignado, creador',
    });
  }

  // Solo procesar tareas de alta prioridad
  if (prioridad !== 'Alta' && prioridad !== 'HIGH') {
    return res.json({
      success: true,
      message: 'Tarea no es de alta prioridad, no se envía a WhatsApp',
      sent: false,
    });
  }

  const task: WhatsAppTask = {
    id: id || `task-${Date.now()}`,
    titulo,
    descripcion: descripcion || '',
    prioridad: 'Alta',
    asignado,
    creador,
    proyecto: proyecto || 'Sin proyecto',
    fechaLimite: fechaLimite || null,
    creadoEn: new Date().toISOString(),
  };

  pendingHighPriorityTasks.push(task);

  console.log('[Webhook] Nueva tarea de alta prioridad agregada a la cola:', task.titulo);
  console.log('[Webhook] Total de tareas en cola:', pendingHighPriorityTasks.length);

  res.status(201).json({
    success: true,
    message: 'Tarea agregada a la cola de WhatsApp',
    sent: true,
    task,
  });
});

/**
 * DELETE /api/webhook/whatsapp/tasks
 *
 * Limpiar todas las tareas pendientes (admin/debug)
 */
router.delete('/whatsapp/tasks', authMiddleware, (req: Request, res: Response) => {
  const count = pendingHighPriorityTasks.length;
  pendingHighPriorityTasks.length = 0;

  res.json({
    success: true,
    message: `Se eliminaron ${count} tareas de la cola`,
    deleted: count,
  });
});

export default router;
