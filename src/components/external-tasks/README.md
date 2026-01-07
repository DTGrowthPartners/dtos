# Componentes de Tareas Externas

Este directorio contiene los componentes de visualización para tareas del sistema externo de gestión de tareas.

## Componentes Principales

### TaskCard.tsx
Vista de tarjeta individual para mostrar tareas en formato de card grid.

**Características:**
- Muestra título, descripción, prioridad, proyecto y fechas
- Soporte para imágenes adjuntas
- Indicador de comentarios
- Botón para abrir tarea en sistema externo
- Vista responsive (mobile/desktop)
- SOLO LECTURA - no permite edición directa

**Props:**
```typescript
{
  task: ExternalTask;
  project?: ExternalProject;
  onOpenImageModal?: (imageSrc: string) => void;
  isMobile?: boolean;
}
```

### TaskListItem.tsx
Vista de lista detallada para mostrar tareas en formato de lista.

**Características:**
- Layout horizontal con información completa
- Indicador de estado visual
- Información de prioridad, proyecto y tipo
- Metadata de fecha y asignación
- Indicadores de comentarios e imágenes
- SOLO LECTURA - clic abre en sistema externo

**Props:**
```typescript
{
  task: ExternalTask;
  project?: ExternalProject;
  onOpenImageModal?: (imageSrc: string) => void;
}
```

### TaskCompactListItem.tsx
Vista ultra compacta para listas densas de tareas.

**Características:**
- Altura mínima para máxima densidad
- Solo información esencial (título, estado, prioridad)
- Indicador de color de proyecto
- Perfecto para vistas de resumen
- SOLO LECTURA - clic abre en sistema externo

**Props:**
```typescript
{
  task: ExternalTask;
  project?: ExternalProject;
}
```

### UnifiedTaskList.tsx
Vista de tabla unificada con filtros y ordenamiento.

**Características:**
- Vista de tabla con columnas fijas
- Filtros por estado (TODO, IN_PROGRESS, DONE, Todos)
- Contador de tareas por estado
- Botón para abrir sistema completo
- Header sticky
- Filas alternadas para mejor legibilidad
- SOLO LECTURA - clic en fila abre tarea en sistema externo

**Props:**
```typescript
{
  tasks: ExternalTask[];
  projects: ExternalProject[];
  columns: Array<{ status: string; name: string }>;
}
```

## Tipos de Datos

Los componentes utilizan los siguientes tipos de `@/lib/externalTasksService`:

```typescript
interface ExternalTask {
  id: string;
  title: string;
  description: string;
  status: string; // 'TODO', 'IN_PROGRESS', 'DONE'
  priority: string; // 'LOW', 'MEDIUM', 'HIGH'
  assignee: string;
  creator: string;
  projectId: string;
  type?: string;
  startDate?: number;
  dueDate?: number;
  images?: string[];
  comments?: Array<{...}>;
  createdAt: number;
}

interface ExternalProject {
  id: string;
  name: string;
  color: string; // Tailwind color class
}
```

## Utilidades

Los componentes utilizan las siguientes utilidades de `@/utils/dateUtils`:

- `formatDate(timestamp)` - Formatea fecha a DD/MM/YYYY
- `formatRelativeDate(timestamp)` - Formatea como "Hoy", "Mañana", "En X días"
- `isOverdue(dueDate)` - Verifica si está vencida
- `getDateBadgeColor(dueDate, status)` - Retorna clases de color para badge

## Diferencias con App Original

### Removido:
- **PomodoroTimer** - No se incluye funcionalidad de Pomodoro
- **PomodoroHistory** - No se muestra historial de Pomodoros
- **StatusSelector** - No se permite cambiar estado (solo lectura)
- **Controles de edición/eliminación** - Todas las acciones redirigen al sistema externo
- **Drag & Drop** - No se permite reordenar tareas

### Agregado:
- **ExternalLink button** - Para abrir tarea en sistema externo
- **getTaskExternalUrl()** - Genera URL al sistema externo
- Indicadores de solo lectura en toda la UI

### Adaptaciones:
- Estados mapeados de `TaskStatus` enum a strings ('TODO', 'IN_PROGRESS', 'DONE')
- Prioridades mapeadas de `Priority` enum a strings ('LOW', 'MEDIUM', 'HIGH')
- Colores de proyecto como strings de clases Tailwind
- Asignados como strings simples en lugar de objetos TEAM_MEMBERS

## Uso

```typescript
import { TaskCard, TaskListItem, UnifiedTaskList } from '@/components/external-tasks';
import { loadUserTasksFromExternal, loadProjectsFromExternal } from '@/lib/externalTasksService';

// En tu componente
const [tasks, setTasks] = useState<ExternalTask[]>([]);
const [projects, setProjects] = useState<ExternalProject[]>([]);

useEffect(() => {
  const loadData = async () => {
    const userTasks = await loadUserTasksFromExternal('Edgardo');
    const allProjects = await loadProjectsFromExternal();
    setTasks(userTasks);
    setProjects(allProjects);
  };
  loadData();
}, []);

// Vista de tarjetas
<div className="grid grid-cols-3 gap-4">
  {tasks.map(task => (
    <TaskCard
      key={task.id}
      task={task}
      project={projects.find(p => p.id === task.projectId)}
    />
  ))}
</div>

// Vista unificada
<UnifiedTaskList
  tasks={tasks}
  projects={projects}
  columns={[
    { status: 'TODO', name: 'Por Hacer' },
    { status: 'IN_PROGRESS', name: 'En Progreso' },
    { status: 'DONE', name: 'Completadas' }
  ]}
/>
```

## Estilos

Todos los componentes mantienen el diseño visual de la app original:
- Tema oscuro con slate-800/900
- Efectos hover con blue-500
- Indicadores de prioridad (red/amber/emerald)
- Badges de fecha con colores según urgencia
- Transiciones suaves
- Diseño responsive
