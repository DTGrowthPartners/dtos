import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from '../services/googleSheets.service';

const router = Router();
const prisma = new PrismaClient();

// Lazy getter for Firestore (Firebase might not be initialized at import time)
const getFirestore = () => admin.firestore();

// API Key para el bot de WhatsApp (configurar en .env)
const BOT_API_KEY = process.env.BOT_API_KEY || 'dt-bot-secret-key-2024';

// Team members válidos para el sistema de tareas
const VALID_TEAM_MEMBERS = ['Lía', 'Dairo', 'Stiven', 'Mariana', 'Jose', 'Anderson', 'Edgardo', 'Jhonathan'];

// Middleware para verificar API key del bot
const verifyBotApiKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey || apiKey !== BOT_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'API key inválida o faltante',
    });
  }

  next();
};

// Cola en memoria para tareas de alta prioridad (el chatbot las consume)
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
 */
router.get('/whatsapp/tasks', (req: Request, res: Response) => {
  const tasks = [...pendingHighPriorityTasks];
  pendingHighPriorityTasks.length = 0;

  res.json({
    success: true,
    count: tasks.length,
    tasks,
  });
});

/**
 * GET /api/webhook/whatsapp/tasks/peek
 */
router.get('/whatsapp/tasks/peek', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: pendingHighPriorityTasks.length,
    tasks: pendingHighPriorityTasks,
  });
});

/**
 * POST /api/webhook/whatsapp/tasks
 */
router.post('/whatsapp/tasks', authMiddleware, (req: Request, res: Response) => {
  const { id, titulo, descripcion, prioridad, asignado, creador, proyecto, fechaLimite } = req.body;

  if (!titulo || !prioridad || !asignado || !creador) {
    return res.status(400).json({
      success: false,
      error: 'Campos requeridos: titulo, prioridad, asignado, creador',
    });
  }

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

  res.status(201).json({
    success: true,
    message: 'Tarea agregada a la cola de WhatsApp',
    sent: true,
    task,
  });
});

/**
 * DELETE /api/webhook/whatsapp/tasks
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

// ==================== Bot API (para crear tareas en FIRESTORE) ====================

/**
 * GET /api/webhook/bot/team
 *
 * Lista los miembros del equipo válidos para asignar tareas.
 */
router.get('/bot/team', verifyBotApiKey, (req: Request, res: Response) => {
  res.json({
    success: true,
    members: VALID_TEAM_MEMBERS,
  });
});

/**
 * GET /api/webhook/bot/projects
 *
 * Lista los proyectos disponibles en Firestore.
 */
router.get('/bot/projects', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const snapshot = await getFirestore().collection('projects').get();
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      color: doc.data().color,
      archived: doc.data().archived || false,
    }));

    // Filtrar proyectos no archivados
    const activeProjects = projects.filter(p => !p.archived);

    res.json({
      success: true,
      count: activeProjects.length,
      projects: activeProjects,
    });
  } catch (error) {
    console.error('[Bot API] Error listando proyectos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener proyectos',
    });
  }
});

/**
 * POST /api/webhook/bot/tasks
 *
 * Crea una tarea en FIRESTORE (donde el frontend las lee).
 *
 * Headers:
 *   x-api-key: <BOT_API_KEY>
 *
 * Body:
 * {
 *   "titulo": "Actualizar el home de tennis cartagena",
 *   "descripcion": "Descripción opcional",
 *   "asignado": "Edgardo",           // Miembro del equipo (Lía, Dairo, Stiven, Mariana, Jose, Anderson, Edgardo, Jhonathan)
 *   "creador": "Dairo",              // Quien asigna la tarea (default: Dairo)
 *   "proyecto": "Tennis Cartagena",  // Nombre del proyecto (busca por nombre o ID)
 *   "prioridad": "media",            // baja, media, alta (default: media)
 *   "fechaFin": "2025-01-30",        // Fecha límite (YYYY-MM-DD)
 *   "tipo": "Diseño"                 // Tipo de tarea (opcional)
 * }
 */
router.post('/bot/tasks', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const {
      titulo,
      title,
      descripcion,
      description,
      asignado,
      assignee,
      creador,
      creator,
      proyecto,
      project,
      projectId,
      prioridad,
      priority,
      fechaFin,
      dueDate,
      fechaInicio,
      startDate,
      tipo,
      type,
    } = req.body;

    // Resolver valores con fallbacks
    const taskTitle = titulo || title;
    const taskDescription = descripcion || description || '';
    const assigneeName = asignado || assignee || 'Stiven';
    const creatorName = creador || creator || 'Dairo';
    const projectName = proyecto || project;
    const taskProjectId = projectId;
    const taskPriority = prioridad || priority || 'media';
    const taskDueDate = fechaFin || dueDate;
    const taskStartDate = fechaInicio || startDate;
    const taskType = tipo || type;

    // Validar título
    if (!taskTitle) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: titulo',
      });
    }

    // Validar y normalizar assignee
    const normalizedAssignee = VALID_TEAM_MEMBERS.find(
      m => m.toLowerCase() === assigneeName.toLowerCase()
    );
    if (!normalizedAssignee) {
      return res.status(400).json({
        success: false,
        error: `Asignado "${assigneeName}" no válido`,
        validMembers: VALID_TEAM_MEMBERS,
      });
    }

    // Validar y normalizar creator
    const normalizedCreator = VALID_TEAM_MEMBERS.find(
      m => m.toLowerCase() === creatorName.toLowerCase()
    ) || 'Dairo';

    // Buscar proyecto por ID o nombre
    let resolvedProjectId: string | null = null;
    let projectNameResolved = 'Sin proyecto';

    if (taskProjectId) {
      // Si se proporciona ID, verificar que existe
      const projectDoc = await getFirestore().collection('projects').doc(taskProjectId).get();
      if (projectDoc.exists) {
        resolvedProjectId = taskProjectId;
        projectNameResolved = projectDoc.data()?.name || 'Sin proyecto';
      }
    } else if (projectName) {
      // Buscar por nombre (case insensitive)
      const projectsSnapshot = await getFirestore().collection('projects').get();
      const foundProject = projectsSnapshot.docs.find(doc => {
        const name = doc.data().name || '';
        return name.toLowerCase().includes(projectName.toLowerCase()) ||
          projectName.toLowerCase().includes(name.toLowerCase());
      });
      if (foundProject) {
        resolvedProjectId = foundProject.id;
        projectNameResolved = foundProject.data().name;
      }
    }

    // Si no se encontró proyecto, usar el primero disponible
    if (!resolvedProjectId) {
      const firstProject = await getFirestore().collection('projects')
        .where('archived', '!=', true)
        .limit(1)
        .get();
      if (!firstProject.empty) {
        resolvedProjectId = firstProject.docs[0].id;
        projectNameResolved = firstProject.docs[0].data().name;
      } else {
        // Intentar sin filtro de archived
        const anyProject = await getFirestore().collection('projects').limit(1).get();
        if (!anyProject.empty) {
          resolvedProjectId = anyProject.docs[0].id;
          projectNameResolved = anyProject.docs[0].data().name;
        }
      }
    }

    if (!resolvedProjectId) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró ningún proyecto. Crea uno primero.',
      });
    }

    // Mapear prioridad a formato Firestore (uppercase)
    const priorityMap: Record<string, string> = {
      baja: 'LOW',
      low: 'LOW',
      media: 'MEDIUM',
      medium: 'MEDIUM',
      normal: 'MEDIUM',
      alta: 'HIGH',
      high: 'HIGH',
      urgente: 'HIGH',
    };
    const mappedPriority = priorityMap[taskPriority.toLowerCase()] || 'MEDIUM';

    // Parsear fechas a timestamp
    let dueDateTimestamp: number | undefined;
    if (taskDueDate) {
      const date = new Date(taskDueDate);
      if (!taskDueDate.includes('T')) {
        date.setHours(12, 0, 0, 0); // Mediodía por defecto (evita problemas de timezone)
      }
      dueDateTimestamp = date.getTime();
    }

    let startDateTimestamp: number | undefined;
    if (taskStartDate) {
      const date = new Date(taskStartDate);
      if (!taskStartDate.includes('T')) {
        date.setHours(12, 0, 0, 0);
      }
      startDateTimestamp = date.getTime();
    }

    // Crear el documento de tarea para Firestore
    const taskData: Record<string, any> = {
      title: taskTitle,
      description: taskDescription,
      status: 'TODO',
      priority: mappedPriority,
      assignee: normalizedAssignee,
      creator: normalizedCreator,
      projectId: resolvedProjectId,
      createdAt: Date.now(),
      images: [],
    };

    // Campos opcionales
    if (dueDateTimestamp) taskData.dueDate = dueDateTimestamp;
    if (startDateTimestamp) taskData.startDate = startDateTimestamp;
    if (taskType) taskData.type = taskType;

    // Crear tarea en Firestore
    const docRef = await getFirestore().collection('tasks').add(taskData);

    console.log(`[Bot API] Tarea creada en Firestore: "${taskTitle}" asignada a ${normalizedAssignee} en proyecto ${projectNameResolved}`);

    // Si es alta prioridad, también agregar a la cola de WhatsApp
    if (mappedPriority === 'HIGH') {
      pendingHighPriorityTasks.push({
        id: docRef.id,
        titulo: taskTitle,
        descripcion: taskDescription,
        prioridad: 'Alta',
        asignado: normalizedAssignee,
        creador: normalizedCreator,
        proyecto: projectNameResolved,
        fechaLimite: taskDueDate || null,
        creadoEn: new Date().toISOString(),
      });
    }

    res.status(201).json({
      success: true,
      message: `Tarea creada: "${taskTitle}" asignada a ${normalizedAssignee}`,
      task: {
        id: docRef.id,
        title: taskTitle,
        description: taskDescription,
        status: 'TODO',
        priority: mappedPriority,
        assignee: normalizedAssignee,
        creator: normalizedCreator,
        project: {
          id: resolvedProjectId,
          name: projectNameResolved,
        },
        dueDate: taskDueDate || null,
        createdAt: taskData.createdAt,
      },
    });
  } catch (error) {
    console.error('[Bot API] Error creando tarea en Firestore:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear la tarea',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/webhook/bot/tasks
 *
 * Lista las tareas de un miembro del equipo desde Firestore.
 */
router.get('/bot/tasks', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { usuario, user: userAlias, estado, status: statusAlias } = req.query;
    const userName = (usuario || userAlias) as string;
    const taskStatus = (estado || statusAlias) as string | undefined;

    if (!userName) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro requerido: usuario',
        validMembers: VALID_TEAM_MEMBERS,
      });
    }

    // Normalizar nombre de usuario
    const normalizedUser = VALID_TEAM_MEMBERS.find(
      m => m.toLowerCase() === userName.toLowerCase()
    );

    if (!normalizedUser) {
      return res.status(404).json({
        success: false,
        error: `Usuario "${userName}" no encontrado`,
        validMembers: VALID_TEAM_MEMBERS,
      });
    }

    // Mapear status si se especificó
    let mappedStatus: string | undefined;
    if (taskStatus) {
      const statusMap: Record<string, string> = {
        pending: 'TODO',
        todo: 'TODO',
        in_progress: 'IN_PROGRESS',
        inprogress: 'IN_PROGRESS',
        done: 'DONE',
        completed: 'DONE',
      };
      mappedStatus = statusMap[taskStatus.toLowerCase()] || taskStatus.toUpperCase();
    }

    // Consultar Firestore solo por assignee (evita necesidad de índice compuesto)
    const snapshot = await getFirestore().collection('tasks')
      .where('assignee', '==', normalizedUser)
      .get();

    // Filtrar y ordenar en memoria
    let tasks = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          titulo: data.title,
          descripcion: data.description || '',
          estado: data.status,
          prioridad: data.priority,
          proyecto: data.projectId,
          fechaLimite: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null,
          creadoEn: data.createdAt,
        };
      })
      .filter(t => !mappedStatus || t.estado === mappedStatus) // Filtrar por status si se especificó
      .sort((a, b) => b.creadoEn - a.creadoEn) // Ordenar por fecha desc
      .slice(0, 30) // Limitar a 30 resultados
      .map(t => ({
        ...t,
        creadoEn: new Date(t.creadoEn).toISOString(),
      }));

    res.json({
      success: true,
      user: normalizedUser,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error('[Bot API] Error listando tareas desde Firestore:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tareas',
    });
  }
});

/**
 * GET /api/webhook/bot/tasks/all
 *
 * Lista las tareas pendientes de TODO el equipo (para notificaciones diarias).
 * Agrupa por usuario y muestra solo tareas TODO e IN_PROGRESS.
 */
router.get('/bot/tasks/all', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    // Obtener todas las tareas que no están DONE
    const snapshot = await getFirestore().collection('tasks')
      .where('status', 'in', ['TODO', 'IN_PROGRESS'])
      .get();

    // Agrupar por assignee
    const tasksByUser: Record<string, any[]> = {};
    VALID_TEAM_MEMBERS.forEach(member => {
      tasksByUser[member] = [];
    });

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const assignee = data.assignee;

      if (assignee && tasksByUser[assignee]) {
        tasksByUser[assignee].push({
          id: doc.id,
          titulo: data.title,
          descripcion: data.description || '',
          estado: data.status,
          prioridad: data.priority,
          fechaLimite: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null,
          creadoEn: data.createdAt,
        });
      }
    });

    // Ordenar tareas de cada usuario: primero por prioridad (HIGH > MEDIUM > LOW), luego por fecha
    const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

    Object.keys(tasksByUser).forEach(user => {
      tasksByUser[user] = tasksByUser[user]
        .sort((a, b) => {
          // Primero por prioridad
          const pDiff = (priorityOrder[a.prioridad] || 1) - (priorityOrder[b.prioridad] || 1);
          if (pDiff !== 0) return pDiff;
          // Luego por fecha de creación (más reciente primero)
          return b.creadoEn - a.creadoEn;
        })
        .map(t => ({
          ...t,
          creadoEn: new Date(t.creadoEn).toISOString(),
        }));
    });

    // Resumen
    const resumen = VALID_TEAM_MEMBERS.map(member => ({
      usuario: member,
      tareasTodo: tasksByUser[member].filter(t => t.estado === 'TODO').length,
      tareasEnProgreso: tasksByUser[member].filter(t => t.estado === 'IN_PROGRESS').length,
      total: tasksByUser[member].length,
      tareasAlta: tasksByUser[member].filter(t => t.prioridad === 'HIGH').length,
    })).filter(r => r.total > 0);

    const totalTareas = resumen.reduce((sum, r) => sum + r.total, 0);
    const totalAlta = resumen.reduce((sum, r) => sum + r.tareasAlta, 0);

    res.json({
      success: true,
      fecha: new Date().toISOString().split('T')[0],
      resumenGeneral: {
        totalTareasPendientes: totalTareas,
        tareasAltaPrioridad: totalAlta,
        miembrosConTareas: resumen.length,
      },
      resumenPorUsuario: resumen,
      tareasPorUsuario: tasksByUser,
    });
  } catch (error) {
    console.error('[Bot API] Error listando todas las tareas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tareas del equipo',
    });
  }
});

// ==================== Bot API (Datos del Sistema - PostgreSQL) ====================

/**
 * GET /api/webhook/bot/clients
 *
 * Lista los clientes con sus servicios activos.
 * Query params:
 *   - status: active, inactive (default: active)
 *   - search: buscar por nombre o email
 */
router.get('/bot/clients', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { status, search, buscar } = req.query;
    const searchTerm = (search || buscar) as string | undefined;
    const clientStatus = (status as string) || 'active';

    const clients = await prisma.client.findMany({
      where: {
        status: clientStatus,
        ...(searchTerm && {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        services: {
          where: { estado: 'activo' },
          include: {
            service: {
              select: { id: true, name: true, price: true, currency: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formattedClients = clients.map(client => ({
      id: client.id,
      nombre: client.name,
      email: client.email,
      telefono: client.phone,
      nit: client.nit,
      estado: client.status,
      serviciosActivos: client.services.map(cs => ({
        id: cs.id,
        servicio: cs.service.name,
        precio: cs.precioCliente || cs.service.price,
        moneda: cs.moneda || cs.service.currency,
        frecuencia: cs.frecuencia,
        fechaInicio: cs.fechaInicio?.toISOString().split('T')[0],
        proximoCobro: cs.fechaProximoCobro?.toISOString().split('T')[0],
      })),
      totalServicios: client.services.length,
    }));

    res.json({
      success: true,
      count: formattedClients.length,
      clients: formattedClients,
    });
  } catch (error) {
    console.error('[Bot API] Error listando clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes',
    });
  }
});

/**
 * GET /api/webhook/bot/clients/:id
 *
 * Obtiene un cliente específico con todos sus datos.
 */
router.get('/bot/clients/:id', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        accounts: {
          where: { status: 'active' },
          orderBy: { nextDueDate: 'asc' },
        },
        terceros: true,
      },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      client: {
        id: client.id,
        nombre: client.name,
        email: client.email,
        telefono: client.phone,
        nit: client.nit,
        direccion: client.address,
        estado: client.status,
        servicios: client.services.map(cs => ({
          id: cs.id,
          servicio: cs.service.name,
          precio: cs.precioCliente || cs.service.price,
          moneda: cs.moneda,
          frecuencia: cs.frecuencia,
          estado: cs.estado,
          fechaInicio: cs.fechaInicio?.toISOString().split('T')[0],
          proximoCobro: cs.fechaProximoCobro?.toISOString().split('T')[0],
          notas: cs.notas,
        })),
        cuentas: client.accounts.map(acc => ({
          id: acc.id,
          tipo: acc.type,
          concepto: acc.concept,
          monto: acc.amount,
          moneda: acc.currency,
          proximoVencimiento: acc.nextDueDate?.toISOString().split('T')[0],
        })),
        contactos: client.terceros.map(t => ({
          id: t.id,
          nombre: t.nombre,
          telefono: t.telefono,
          email: t.email,
          cargo: t.cargo,
        })),
        creadoEn: client.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Bot API] Error obteniendo cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente',
    });
  }
});

/**
 * GET /api/webhook/bot/services
 *
 * Lista todos los servicios disponibles.
 */
router.get('/bot/services', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { status: 'active' },
      include: {
        _count: {
          select: { clients: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    const formattedServices = services.map(service => ({
      id: service.id,
      nombre: service.name,
      descripcion: service.description,
      precio: service.price,
      moneda: service.currency,
      duracion: service.duration,
      icono: service.icon,
      clientesActivos: service._count.clients,
    }));

    res.json({
      success: true,
      count: formattedServices.length,
      services: formattedServices,
    });
  } catch (error) {
    console.error('[Bot API] Error listando servicios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener servicios',
    });
  }
});

/**
 * GET /api/webhook/bot/finances
 *
 * Resumen financiero COMPLETO con datos de Google Sheets:
 * - Presupuesto Q1 (proyectado vs real)
 * - Ingresos y gastos del mes actual
 * - Gastos por categoría
 * - Cuentas por cobrar/pagar del sistema
 *
 * Query params:
 *   - mes: enero, febrero, marzo (default: mes actual del Q1)
 */
router.get('/bot/finances', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { mes, month } = req.query;
    const requestedMonth = (mes || month) as string | undefined;

    // Obtener datos de Google Sheets
    const [financeData, budgetData] = await Promise.all([
      googleSheetsService.getFinanceData(),
      googleSheetsService.getBudgetData(),
    ]);

    // Determinar el mes actual del Q1 (enero=0, febrero=1, marzo=2)
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    let mesActual: 'enero' | 'febrero' | 'marzo' = 'enero';
    if (currentMonth === 1) mesActual = 'febrero';
    else if (currentMonth >= 2) mesActual = 'marzo';

    // Si se especificó un mes, usarlo
    if (requestedMonth) {
      const monthLower = requestedMonth.toLowerCase();
      if (['enero', 'january', '1'].includes(monthLower)) mesActual = 'enero';
      else if (['febrero', 'february', '2'].includes(monthLower)) mesActual = 'febrero';
      else if (['marzo', 'march', '3'].includes(monthLower)) mesActual = 'marzo';
    }

    // Extraer datos del presupuesto Q1
    const presupuestoMes = {
      ingresos: budgetData.ingresos.totales[mesActual],
      gastos: budgetData.gastos.totales[mesActual],
    };

    // Calcular ejecución del presupuesto
    const ejecucionIngresos = presupuestoMes.ingresos.proyectado > 0
      ? Math.round((presupuestoMes.ingresos.real / presupuestoMes.ingresos.proyectado) * 100)
      : 0;
    const ejecucionGastos = presupuestoMes.gastos.proyectado > 0
      ? Math.round((presupuestoMes.gastos.real / presupuestoMes.gastos.proyectado) * 100)
      : 0;

    // Resultado (utilidad)
    const utilidadProyectada = presupuestoMes.ingresos.proyectado - presupuestoMes.gastos.proyectado;
    const utilidadReal = presupuestoMes.ingresos.real - presupuestoMes.gastos.real;

    // Filtrar transacciones del mes actual
    const mesNumero = mesActual === 'enero' ? '01' : mesActual === 'febrero' ? '02' : '03';
    const anioActual = now.getFullYear();

    const ingresosDelMes = financeData.ingresos.filter(t => {
      return t.fecha.startsWith(`${anioActual}-${mesNumero}`) && t.categoria !== 'AJUSTE SALDO';
    });

    const gastosDelMes = financeData.gastos.filter(t => {
      return t.fecha.startsWith(`${anioActual}-${mesNumero}`) && t.categoria !== 'AJUSTE SALDO';
    });

    // Top 5 gastos del mes
    const topGastos = [...gastosDelMes]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);

    // Top 5 ingresos del mes
    const topIngresos = [...ingresosDelMes]
      .sort((a, b) => b.importe - a.importe)
      .slice(0, 5);

    // Gastos por categoría del mes
    const gastosPorCategoria: Record<string, number> = {};
    gastosDelMes.forEach(g => {
      const cat = g.categoria || 'Otros';
      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + g.importe;
    });

    // Obtener cuentas por cobrar/pagar del sistema (Prisma)
    const accounts = await prisma.account.findMany({
      where: { status: 'active' },
      include: { client: { select: { name: true } } },
      orderBy: { nextDueDate: 'asc' },
    });

    const cuentasPorCobrar = accounts.filter(a => a.type === 'receivable');
    const cuentasPorPagar = accounts.filter(a => a.type === 'payable');
    const totalPorCobrar = cuentasPorCobrar.reduce((sum, a) => sum + a.amount, 0);
    const totalPorPagar = cuentasPorPagar.reduce((sum, a) => sum + a.amount, 0);

    // Próximos vencimientos (7 días)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const proximosVencimientos = accounts
      .filter(a => a.nextDueDate && a.nextDueDate <= nextWeek && a.nextDueDate >= now)
      .map(a => ({
        tipo: a.type === 'receivable' ? 'Por Cobrar' : 'Por Pagar',
        entidad: a.entityName,
        monto: a.amount,
        vencimiento: a.nextDueDate?.toISOString().split('T')[0],
      }));

    // Detalle de gastos por categoría del presupuesto
    const categoriasPresupuesto = Object.entries(budgetData.gastos.categorias).map(([nombre, datos]) => ({
      categoria: nombre,
      proyectado: datos[mesActual].proyectado,
      real: datos[mesActual].real,
      ejecucion: datos[mesActual].proyectado > 0
        ? Math.round((datos[mesActual].real / datos[mesActual].proyectado) * 100)
        : 0,
      estado: datos[mesActual].real > datos[mesActual].proyectado ? '🔴 Excedido' :
              datos[mesActual].real > datos[mesActual].proyectado * 0.8 ? '🟡 Alerta' : '🟢 OK',
    })).filter(c => c.proyectado > 0 || c.real > 0);

    res.json({
      success: true,
      mes: mesActual.charAt(0).toUpperCase() + mesActual.slice(1) + ' 2025',

      // Resumen ejecutivo
      resumenEjecutivo: {
        ingresosProyectados: presupuestoMes.ingresos.proyectado,
        ingresosReales: presupuestoMes.ingresos.real,
        ejecucionIngresos: `${ejecucionIngresos}%`,
        gastosProyectados: presupuestoMes.gastos.proyectado,
        gastosReales: presupuestoMes.gastos.real,
        ejecucionGastos: `${ejecucionGastos}%`,
        utilidadProyectada,
        utilidadReal,
        estadoUtilidad: utilidadReal >= utilidadProyectada ? '🟢 Cumpliendo' : '🔴 Por debajo',
      },

      // Presupuesto trimestral completo
      presupuestoQ1: {
        enero: {
          ingresos: budgetData.ingresos.totales.enero,
          gastos: budgetData.gastos.totales.enero,
          utilidad: budgetData.ingresos.totales.enero.real - budgetData.gastos.totales.enero.real,
        },
        febrero: {
          ingresos: budgetData.ingresos.totales.febrero,
          gastos: budgetData.gastos.totales.febrero,
          utilidad: budgetData.ingresos.totales.febrero.real - budgetData.gastos.totales.febrero.real,
        },
        marzo: {
          ingresos: budgetData.ingresos.totales.marzo,
          gastos: budgetData.gastos.totales.marzo,
          utilidad: budgetData.ingresos.totales.marzo.real - budgetData.gastos.totales.marzo.real,
        },
      },

      // Detalle de categorías de gastos vs presupuesto
      categoriasGastos: categoriasPresupuesto.slice(0, 10),

      // Transacciones del mes
      transaccionesMes: {
        totalIngresos: ingresosDelMes.reduce((sum, t) => sum + t.importe, 0),
        totalGastos: gastosDelMes.reduce((sum, t) => sum + t.importe, 0),
        cantidadIngresos: ingresosDelMes.length,
        cantidadGastos: gastosDelMes.length,
        topIngresos: topIngresos.map(t => ({
          fecha: t.fecha,
          monto: t.importe,
          descripcion: t.descripcion,
          entidad: t.entidad,
          categoria: t.categoria,
          terceroId: t.terceroId,
        })),
        topGastos: topGastos.map(t => ({
          fecha: t.fecha,
          monto: t.importe,
          descripcion: t.descripcion,
          entidad: t.entidad,
          categoria: t.categoria,
          terceroId: t.terceroId,
        })),
        gastosPorCategoria: Object.entries(gastosPorCategoria)
          .map(([categoria, monto]) => ({ categoria, monto }))
          .sort((a, b) => b.monto - a.monto),
      },

      // Análisis por tercero (gastos agrupados por entidad/tercero)
      gastosPorTercero: (() => {
        const terceroMap: Record<string, { total: number; count: number; terceroId?: string }> = {};
        gastosDelMes.forEach(g => {
          const key = g.entidad || 'Sin Entidad';
          if (!terceroMap[key]) {
            terceroMap[key] = { total: 0, count: 0, terceroId: g.terceroId };
          }
          terceroMap[key].total += g.importe;
          terceroMap[key].count += 1;
        });
        return Object.entries(terceroMap)
          .map(([nombre, data]) => ({ nombre, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
      })(),

      // Ingresos por tercero/cliente
      ingresosPorTercero: (() => {
        const terceroMap: Record<string, { total: number; count: number; terceroId?: string }> = {};
        ingresosDelMes.forEach(i => {
          const key = i.entidad || 'Sin Entidad';
          if (!terceroMap[key]) {
            terceroMap[key] = { total: 0, count: 0, terceroId: i.terceroId };
          }
          terceroMap[key].total += i.importe;
          terceroMap[key].count += 1;
        });
        return Object.entries(terceroMap)
          .map(([nombre, data]) => ({ nombre, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
      })(),

      // Cuentas por cobrar/pagar (del sistema)
      cuentas: {
        totalPorCobrar,
        totalPorPagar,
        balance: totalPorCobrar - totalPorPagar,
        cantidadPorCobrar: cuentasPorCobrar.length,
        cantidadPorPagar: cuentasPorPagar.length,
        proximosVencimientos,
      },

      // Totales generales (de sheets)
      totalesGenerales: {
        totalIngresosHistorico: financeData.totalIncome,
        totalGastosHistorico: financeData.totalExpenses,
        beneficioHistorico: financeData.totalIncome - financeData.totalExpenses,
      },
    });
  } catch (error) {
    console.error('[Bot API] Error obteniendo finanzas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información financiera',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/webhook/bot/terceros
 *
 * Lista terceros (contactos, proveedores, empleados).
 * Query params:
 *   - tipo: prospecto, cliente, proveedor, empleado, all (default: all)
 *   - search: buscar por nombre, email o teléfono
 */
router.get('/bot/terceros', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { tipo, type, search, buscar } = req.query;
    const terceroType = (tipo || type) as string | undefined;
    const searchTerm = (search || buscar) as string | undefined;

    const whereClause: any = { estado: 'activo' };

    // Filtrar por tipo
    if (terceroType && terceroType !== 'all') {
      switch (terceroType.toLowerCase()) {
        case 'prospecto':
          whereClause.esProspecto = true;
          break;
        case 'cliente':
          whereClause.esCliente = true;
          break;
        case 'proveedor':
          whereClause.esProveedor = true;
          break;
        case 'empleado':
          whereClause.esEmpleado = true;
          break;
      }
    }

    // Búsqueda
    if (searchTerm) {
      whereClause.OR = [
        { nombre: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { telefono: { contains: searchTerm } },
      ];
    }

    const terceros = await prisma.tercero.findMany({
      where: whereClause,
      include: {
        client: { select: { id: true, name: true } },
        organizacion: { select: { id: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    const getTipos = (t: any) => {
      const tipos = [];
      if (t.esProspecto) tipos.push('Prospecto');
      if (t.esCliente) tipos.push('Cliente');
      if (t.esProveedor) tipos.push('Proveedor');
      if (t.esEmpleado) tipos.push('Empleado');
      return tipos;
    };

    res.json({
      success: true,
      count: terceros.length,
      terceros: terceros.map(t => ({
        id: t.id,
        nombre: t.nombre,
        email: t.email,
        telefono: t.telefono ? `${t.telefonoCodigo}${t.telefono}` : null,
        tipos: getTipos(t),
        empresa: t.client?.name || t.organizacion?.nombre,
        cargo: t.cargo,
        categoriaProveedor: t.categoriaProveedor,
        notas: t.notas,
        tags: t.tags,
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error listando terceros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener terceros',
    });
  }
});

/**
 * GET /api/webhook/bot/crm
 *
 * Resumen del CRM: deals por etapa, próximos seguimientos.
 */
router.get('/bot/crm', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    // Obtener etapas del pipeline
    const stages = await prisma.dealStage.findMany({
      orderBy: { position: 'asc' },
      include: {
        deals: {
          where: { deletedAt: null },
          include: {
            owner: { select: { firstName: true, lastName: true } },
            service: { select: { name: true } },
          },
        },
      },
    });

    // Calcular métricas
    const allDeals = stages.flatMap(s => s.deals);
    const totalDeals = allDeals.length;
    const totalValue = allDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);

    // Próximos seguimientos
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingFollowUps = allDeals
      .filter(d => d.nextFollowUp && d.nextFollowUp <= nextWeek && d.nextFollowUp >= now)
      .sort((a, b) => (a.nextFollowUp?.getTime() || 0) - (b.nextFollowUp?.getTime() || 0));

    // Deals ganados/perdidos este mes
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonDeals = allDeals.filter(d =>
      stages.find(s => s.id === d.stageId)?.isWon &&
      d.closedAt && d.closedAt >= monthStart
    );
    const lostDeals = allDeals.filter(d =>
      stages.find(s => s.id === d.stageId)?.isLost &&
      d.closedAt && d.closedAt >= monthStart
    );

    res.json({
      success: true,
      resumen: {
        totalDeals,
        valorTotal: totalValue,
        dealsGanadosMes: wonDeals.length,
        valorGanadoMes: wonDeals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0),
        dealsPerdidosMes: lostDeals.length,
        seguimientosPendientes: upcomingFollowUps.length,
      },
      pipeline: stages.map(stage => ({
        id: stage.id,
        nombre: stage.name,
        color: stage.color,
        esGanado: stage.isWon,
        esPerdido: stage.isLost,
        deals: stage.deals.map(deal => ({
          id: deal.id,
          nombre: deal.name,
          empresa: deal.company,
          telefono: deal.phone ? `${deal.phoneCountryCode}${deal.phone}` : null,
          valorEstimado: deal.estimatedValue,
          moneda: deal.currency,
          servicio: deal.service?.name,
          propietario: deal.owner ? `${deal.owner.firstName} ${deal.owner.lastName}` : null,
          probabilidad: deal.probability,
          prioridad: deal.priority,
          proximoSeguimiento: deal.nextFollowUp?.toISOString().split('T')[0],
          ultimaInteraccion: deal.lastInteractionAt?.toISOString().split('T')[0],
        })),
        totalDeals: stage.deals.length,
        valorTotal: stage.deals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0),
      })),
      proximosSeguimientos: upcomingFollowUps.slice(0, 10).map(deal => ({
        id: deal.id,
        nombre: deal.name,
        empresa: deal.company,
        fecha: deal.nextFollowUp?.toISOString().split('T')[0],
        propietario: deal.owner ? `${deal.owner.firstName} ${deal.owner.lastName}` : null,
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error obteniendo CRM:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información del CRM',
    });
  }
});

/**
 * GET /api/webhook/bot/crm/deals
 *
 * Lista deals con filtros.
 * Query params:
 *   - etapa: slug de la etapa
 *   - propietario: nombre del propietario
 *   - prioridad: baja, media, alta, urgente
 */
router.get('/bot/crm/deals', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { etapa, stage, propietario, owner, prioridad, priority } = req.query;
    const stageSlug = (etapa || stage) as string | undefined;
    const ownerName = (propietario || owner) as string | undefined;
    const dealPriority = (prioridad || priority) as string | undefined;

    const whereClause: any = { deletedAt: null };

    if (stageSlug) {
      const stageRecord = await prisma.dealStage.findUnique({ where: { slug: stageSlug } });
      if (stageRecord) {
        whereClause.stageId = stageRecord.id;
      }
    }

    if (dealPriority) {
      whereClause.priority = dealPriority.toLowerCase();
    }

    const deals = await prisma.deal.findMany({
      where: whereClause,
      include: {
        stage: true,
        owner: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        tercero: { select: { nombre: true, telefono: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Filtrar por propietario si se especificó
    let filteredDeals = deals;
    if (ownerName) {
      filteredDeals = deals.filter(d =>
        d.owner &&
        (`${d.owner.firstName} ${d.owner.lastName}`.toLowerCase().includes(ownerName.toLowerCase()) ||
         d.owner.firstName.toLowerCase().includes(ownerName.toLowerCase()))
      );
    }

    res.json({
      success: true,
      count: filteredDeals.length,
      deals: filteredDeals.map(deal => ({
        id: deal.id,
        nombre: deal.name,
        empresa: deal.company,
        telefono: deal.phone ? `${deal.phoneCountryCode}${deal.phone}` : null,
        email: deal.email,
        etapa: deal.stage.name,
        valorEstimado: deal.estimatedValue,
        moneda: deal.currency,
        servicio: deal.service?.name,
        propietario: deal.owner ? `${deal.owner.firstName} ${deal.owner.lastName}` : null,
        probabilidad: deal.probability,
        prioridad: deal.priority,
        fuente: deal.source,
        proximoSeguimiento: deal.nextFollowUp?.toISOString().split('T')[0],
        fechaCierreEsperada: deal.expectedCloseDate?.toISOString().split('T')[0],
        notas: deal.notes,
        tags: deal.tags,
        tercero: deal.tercero ? {
          nombre: deal.tercero.nombre,
          telefono: deal.tercero.telefono,
          email: deal.tercero.email,
        } : null,
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error listando deals:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener deals',
    });
  }
});

/**
 * GET /api/webhook/bot/sheets/terceros
 *
 * Lista terceros desde Google Sheets (proveedores, empleados, freelancers, clientes).
 * Esta es la fuente de verdad para contabilidad.
 *
 * Query params:
 *   - tipo: cliente, proveedor, empleado, freelancer (default: all)
 *   - estado: activo, inactivo (default: activo)
 */
router.get('/bot/sheets/terceros', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { tipo, type, estado, status } = req.query;
    const terceroType = (tipo || type) as string | undefined;
    const terceroStatus = (estado || status) as string | undefined;

    let terceros = await googleSheetsService.getTerceros();

    // Filtrar por tipo si se especificó
    if (terceroType && terceroType !== 'all') {
      terceros = terceros.filter(t => t.tipo.toLowerCase() === terceroType.toLowerCase());
    }

    // Filtrar por estado (default: activo)
    const statusFilter = terceroStatus?.toLowerCase() || 'activo';
    if (statusFilter !== 'all') {
      terceros = terceros.filter(t => t.estado === statusFilter);
    }

    // Resumen por tipo
    const resumenPorTipo = {
      clientes: terceros.filter(t => t.tipo === 'cliente').length,
      proveedores: terceros.filter(t => t.tipo === 'proveedor').length,
      empleados: terceros.filter(t => t.tipo === 'empleado').length,
      freelancers: terceros.filter(t => t.tipo === 'freelancer').length,
    };

    res.json({
      success: true,
      count: terceros.length,
      resumenPorTipo,
      terceros: terceros.map(t => ({
        id: t.id,
        tipo: t.tipo,
        nombre: t.nombre,
        nit: t.nit,
        email: t.email,
        telefono: t.telefono,
        direccion: t.direccion,
        categoria: t.categoria,
        cuentaBancaria: t.cuentaBancaria,
        salarioBase: t.salarioBase,
        cargo: t.cargo,
        estado: t.estado,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error listando terceros de Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener terceros de Google Sheets',
    });
  }
});

/**
 * GET /api/webhook/bot/sheets/nomina
 *
 * Lista registros de nómina desde Google Sheets.
 */
router.get('/bot/sheets/nomina', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const nomina = await googleSheetsService.getNomina();

    // Totales por concepto
    const totalesPorConcepto: Record<string, number> = {};
    nomina.forEach(record => {
      const concepto = record.concepto || 'salario';
      totalesPorConcepto[concepto] = (totalesPorConcepto[concepto] || 0) + record.totalPagado;
    });

    // Total general
    const totalPagado = nomina.reduce((sum, r) => sum + r.totalPagado, 0);
    const totalDeducciones = nomina.reduce((sum, r) => sum + r.deducciones, 0);
    const totalBonificaciones = nomina.reduce((sum, r) => sum + r.bonificaciones, 0);

    res.json({
      success: true,
      count: nomina.length,
      resumen: {
        totalPagado,
        totalDeducciones,
        totalBonificaciones,
        totalesPorConcepto,
      },
      registros: nomina.map(r => ({
        id: r.id,
        fecha: r.fecha,
        terceroId: r.terceroId,
        terceroNombre: r.terceroNombre,
        concepto: r.concepto,
        salarioBase: r.salarioBase,
        deducciones: r.deducciones,
        bonificaciones: r.bonificaciones,
        totalPagado: r.totalPagado,
        notas: r.notas,
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error listando nómina de Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener nómina de Google Sheets',
    });
  }
});

/**
 * GET /api/webhook/bot/sheets/transacciones
 *
 * Lista todas las transacciones (entradas y salidas) desde Google Sheets.
 * Query params:
 *   - tipo: entrada, salida, all (default: all)
 *   - categoria: filtrar por categoría
 *   - terceroId: filtrar por terceroId
 *   - limit: número máximo de resultados (default: 50)
 */
router.get('/bot/sheets/transacciones', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { tipo, type, categoria, category, terceroId, tercero, limit } = req.query;
    const transactionType = (tipo || type) as string | undefined;
    const categoryFilter = (categoria || category) as string | undefined;
    const terceroFilter = (terceroId || tercero) as string | undefined;
    const limitNum = parseInt((limit as string) || '50', 10);

    const financeData = await googleSheetsService.getFinanceData();

    let transacciones: Array<{
      tipo: 'entrada' | 'salida';
      fecha: string;
      importe: number;
      descripcion: string;
      categoria: string;
      cuenta: string;
      entidad: string;
      terceroId?: string;
    }> = [];

    // Agregar ingresos
    if (!transactionType || transactionType === 'all' || transactionType === 'entrada') {
      financeData.ingresos.forEach(t => {
        transacciones.push({
          tipo: 'entrada',
          fecha: t.fecha,
          importe: t.importe,
          descripcion: t.descripcion,
          categoria: t.categoria,
          cuenta: t.cuenta,
          entidad: t.entidad,
          terceroId: t.terceroId,
        });
      });
    }

    // Agregar gastos
    if (!transactionType || transactionType === 'all' || transactionType === 'salida') {
      financeData.gastos.forEach(t => {
        transacciones.push({
          tipo: 'salida',
          fecha: t.fecha,
          importe: t.importe,
          descripcion: t.descripcion,
          categoria: t.categoria,
          cuenta: t.cuenta,
          entidad: t.entidad,
          terceroId: t.terceroId,
        });
      });
    }

    // Filtrar por categoría
    if (categoryFilter) {
      transacciones = transacciones.filter(t =>
        t.categoria.toLowerCase().includes(categoryFilter.toLowerCase())
      );
    }

    // Filtrar por terceroId
    if (terceroFilter) {
      transacciones = transacciones.filter(t =>
        t.terceroId === terceroFilter ||
        t.entidad.toLowerCase().includes(terceroFilter.toLowerCase())
      );
    }

    // Ordenar por fecha (más reciente primero)
    transacciones.sort((a, b) => b.fecha.localeCompare(a.fecha));

    // Limitar resultados
    const totalCount = transacciones.length;
    transacciones = transacciones.slice(0, limitNum);

    res.json({
      success: true,
      count: transacciones.length,
      totalCount,
      resumen: {
        totalEntradas: financeData.totalIncome,
        totalSalidas: financeData.totalExpenses,
        balance: financeData.totalIncome - financeData.totalExpenses,
      },
      transacciones,
    });
  } catch (error) {
    console.error('[Bot API] Error listando transacciones de Sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener transacciones de Google Sheets',
    });
  }
});

export default router;
