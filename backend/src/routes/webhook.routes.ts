import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

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

    // Consultar Firestore
    let query: FirebaseFirestore.Query = getFirestore().collection('tasks')
      .where('assignee', '==', normalizedUser);

    if (taskStatus) {
      // Mapear status
      const statusMap: Record<string, string> = {
        pending: 'TODO',
        todo: 'TODO',
        in_progress: 'IN_PROGRESS',
        inprogress: 'IN_PROGRESS',
        done: 'DONE',
        completed: 'DONE',
      };
      const mappedStatus = statusMap[taskStatus.toLowerCase()] || taskStatus.toUpperCase();
      query = query.where('status', '==', mappedStatus);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(20).get();

    const tasks = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        titulo: data.title,
        descripcion: data.description || '',
        estado: data.status,
        prioridad: data.priority,
        fechaLimite: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null,
        creadoEn: new Date(data.createdAt).toISOString(),
      };
    });

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
 * Resumen financiero: cuentas por cobrar y por pagar.
 * Query params:
 *   - tipo: receivable, payable, all (default: all)
 *   - estado: active, paused, completed (default: active)
 */
router.get('/bot/finances', verifyBotApiKey, async (req: Request, res: Response) => {
  try {
    const { tipo, type, estado, status } = req.query;
    const accountType = (tipo || type) as string | undefined;
    const accountStatus = (estado || status) as string || 'active';

    const whereClause: any = { status: accountStatus };
    if (accountType && accountType !== 'all') {
      whereClause.type = accountType;
    }

    const accounts = await prisma.account.findMany({
      where: whereClause,
      include: {
        client: { select: { id: true, name: true } },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { nextDueDate: 'asc' },
    });

    // Calcular totales
    const receivables = accounts.filter(a => a.type === 'receivable');
    const payables = accounts.filter(a => a.type === 'payable');

    const totalReceivable = receivables.reduce((sum, a) => sum + a.amount, 0);
    const totalPayable = payables.reduce((sum, a) => sum + a.amount, 0);

    // Próximos vencimientos (próximos 7 días)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDue = accounts.filter(
      a => a.nextDueDate && a.nextDueDate <= nextWeek && a.nextDueDate >= now
    );

    res.json({
      success: true,
      resumen: {
        totalPorCobrar: totalReceivable,
        totalPorPagar: totalPayable,
        balance: totalReceivable - totalPayable,
        cuentasPorCobrar: receivables.length,
        cuentasPorPagar: payables.length,
        vencimientosProximos: upcomingDue.length,
      },
      cuentas: accounts.map(acc => ({
        id: acc.id,
        tipo: acc.type === 'receivable' ? 'Por Cobrar' : 'Por Pagar',
        entidad: acc.entityName,
        cliente: acc.client?.name,
        concepto: acc.concept,
        monto: acc.amount,
        moneda: acc.currency,
        esRecurrente: acc.isRecurring,
        frecuencia: acc.frequency,
        proximoVencimiento: acc.nextDueDate?.toISOString().split('T')[0],
        estado: acc.status,
        ultimosPagos: acc.payments.map(p => ({
          monto: p.amount,
          fecha: p.paidAt.toISOString().split('T')[0],
          estado: p.status,
        })),
      })),
      proximosVencimientos: upcomingDue.map(acc => ({
        id: acc.id,
        tipo: acc.type === 'receivable' ? 'Por Cobrar' : 'Por Pagar',
        entidad: acc.entityName,
        concepto: acc.concept,
        monto: acc.amount,
        vencimiento: acc.nextDueDate?.toISOString().split('T')[0],
      })),
    });
  } catch (error) {
    console.error('[Bot API] Error obteniendo finanzas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información financiera',
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

export default router;
