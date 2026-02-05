/**
 * OpenAI Function Calling tool definitions for Kimi AI
 *
 * These tools allow Kimi to access real system data and perform actions:
 * - Query tasks, clients, finances, CRM deals
 * - Create tasks
 * - Search and filter data
 */

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "getTasks",
      description: "Obtener lista de tareas con filtros opcionales. Usa esto cuando el usuario pregunte por tareas, pendientes, o trabajo de cualquier persona del equipo.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["TODO", "IN_PROGRESS", "DONE"],
            description: "Filtrar por estado de tarea: TODO (pendiente), IN_PROGRESS (en progreso), DONE (completada)"
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Filtrar por prioridad: LOW (baja), MEDIUM (media), HIGH (alta)"
          },
          assignee: {
            type: "string",
            description: "Filtrar por persona asignada. Usa el nombre exacto: Lía, Dairo, Stiven, Mariana, Jose, Anderson, Edgardo, Jhonathan"
          },
          search: {
            type: "string",
            description: "Buscar texto en el título o descripción de las tareas"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getClients",
      description: "Obtener lista de clientes con sus servicios activos. Usa esto cuando el usuario pregunte por clientes o sus servicios contratados.",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Buscar cliente por nombre o email"
          },
          status: {
            type: "string",
            enum: ["active", "inactive"],
            description: "Filtrar por estado del cliente: active (activo) o inactive (inactivo)"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getFinances",
      description: "Obtener resumen financiero mensual incluyendo ingresos, gastos, presupuesto y cuentas por cobrar/pagar. Usa esto cuando el usuario pregunte por finanzas, números, ingresos, gastos o presupuesto.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            description: "Mes a consultar: enero, febrero, marzo, etc. Si no se especifica, usa el mes actual.",
            enum: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Crear una nueva tarea en el sistema. Usa esto cuando el usuario pida crear, agregar o registrar una tarea nueva.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Título corto y descriptivo de la tarea"
          },
          description: {
            type: "string",
            description: "Descripción detallada de qué debe hacerse"
          },
          assignee: {
            type: "string",
            description: "Usuario asignado a la tarea. Miembros del equipo: Lía, Dairo, Stiven, Mariana, Jose, Anderson, Edgardo, Jhonathan"
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Prioridad de la tarea: LOW (baja), MEDIUM (media - por defecto), HIGH (alta)"
          },
          projectId: {
            type: "string",
            description: "ID del proyecto al que pertenece la tarea (opcional)"
          }
        },
        required: ["title", "assignee"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getDeals",
      description: "Obtener lista de oportunidades de CRM (deals/negociaciones). Usa esto cuando el usuario pregunte por oportunidades de venta, pipeline, negociaciones o prospectos en proceso.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            description: "Etapa del pipeline donde está la oportunidad (ej: prospecto, propuesta, negociacion, ganado)"
          },
          search: {
            type: "string",
            description: "Buscar por nombre del deal o cliente"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description: "Actualizar el estado de una o más tareas. Usa esto cuando el usuario pida marcar tareas como completadas, cambiar estado, o actualizar tareas existentes. IMPORTANTE: Primero usa getTasks para obtener los IDs de las tareas, luego usa updateTask con esos IDs.",
      parameters: {
        type: "object",
        properties: {
          taskIds: {
            type: "array",
            items: { type: "string" },
            description: "Lista de IDs de tareas a actualizar. Obtén estos IDs usando getTasks primero."
          },
          status: {
            type: "string",
            enum: ["TODO", "IN_PROGRESS", "DONE"],
            description: "Nuevo estado: TODO (pendiente), IN_PROGRESS (en progreso), DONE (completada)"
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Nueva prioridad (opcional)"
          }
        },
        required: ["taskIds", "status"],
        additionalProperties: false
      }
    }
  }
];
