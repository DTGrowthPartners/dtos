import { esResponsable, Priority, TaskStatus, type Project, type Task } from '@/types/taskTypes';

export const FECHAS_FILTRO = [
  { valor: 'todas', texto: 'Cualquier fecha' },
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'semana', texto: 'Esta semana' },
  { valor: 'mes', texto: 'Este mes' },
  { valor: 'vencidas', texto: 'Vencidas' },
  { valor: 'sin-fecha', texto: 'Sin fecha' },
] as const;

export interface FiltrosTareasIA {
  responsable: string;
  proyecto: string;
  carpeta: string;
  prioridad: string;
  fecha: typeof FECHAS_FILTRO[number]['valor'];
}

export const FILTROS_TAREAS_INICIALES: FiltrosTareasIA = {
  responsable: 'mias', proyecto: 'todos', carpeta: 'todas', prioridad: 'todas', fecha: 'todas',
};

/** El filtro de responsable nunca amplía los permisos de Operaciones. */
export const puedeVerTareaIA = (tarea: Task, nombre: string, esAdmin: boolean): boolean =>
  !!nombre && !tarea.deletedAt && (esAdmin || esResponsable(tarea, nombre) || esResponsable({ assignee: tarea.creator }, nombre));

export const filtrarTareasIA = (tareas: Task[], proyectos: Project[], nombre: string, esAdmin: boolean, filtros: FiltrosTareasIA, busqueda = '', ahora = Date.now()): Task[] => {
  const hoy = fechaColombia(ahora);
  // Misma semana de domingo a sábado que Operaciones, en calendario colombiano.
  const inicio = new Date(`${hoy}T12:00:00-05:00`);
  inicio.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay());
  const fin = new Date(inicio.getTime() + 7 * 86400_000);
  const inicioSemana = fechaColombia(inicio.getTime());
  const finSemana = fechaColombia(fin.getTime());
  const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const texto = normalizar(busqueda);
  const proyectosPorId = new Map(proyectos.map((p) => [p.id, p]));
  return tareas.filter((tarea) => {
    if (!puedeVerTareaIA(tarea, nombre, esAdmin)) return false;
    const responsable = filtros.responsable === 'mias' ? nombre : filtros.responsable;
    if (responsable !== 'todos' && !esResponsable(tarea, responsable)) return false;
    if (filtros.proyecto === 'sin-proyecto' ? !!tarea.projectId : filtros.proyecto !== 'todos' && tarea.projectId !== filtros.proyecto) return false;
    if (filtros.carpeta !== 'todas' && proyectosPorId.get(tarea.projectId)?.folderId !== filtros.carpeta) return false;
    if (filtros.prioridad !== 'todas' && tarea.priority !== filtros.prioridad) return false;
    if (texto && !normalizar(`${tarea.title} ${tarea.description || ''}`).includes(texto)) return false;
    const fecha = tarea.dueDate ? fechaColombia(tarea.dueDate) : '';
    switch (filtros.fecha) {
      case 'hoy': return fecha === hoy;
      case 'semana': return !!fecha && fecha >= inicioSemana && fecha < finSemana;
      case 'mes': return !!fecha && fecha.slice(0, 7) === hoy.slice(0, 7);
      case 'vencidas': return !!fecha && fecha < hoy && tarea.status !== TaskStatus.DONE;
      case 'sin-fecha': return !fecha;
      default: return true;
    }
  });
};

/** Las fechas de esta vista son fechas de calendario de Colombia. */
export const fechaColombia = (valor: number = Date.now()): string => {
  const fecha = new Date(valor - 5 * 3600_000);
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
};

export const fechaDeFormulario = (fecha: string, hora = '12:00'): number | undefined => {
  if (!fecha) return undefined;
  const valor = new Date(`${fecha}T${hora || '12:00'}:00-05:00`).getTime();
  return Number.isFinite(valor) && fechaColombia(valor) === fecha ? valor : undefined;
};

export const etiquetaFecha = (valor?: number): string => valor
  ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }).format(valor)
  : 'Sin fecha';

export const ordenarPorUrgencia = (a: Task, b: Task): number => {
  const hoy = fechaColombia();
  const vencidaA = !!a.dueDate && fechaColombia(a.dueDate) < hoy;
  const vencidaB = !!b.dueDate && fechaColombia(b.dueDate) < hoy;
  if (vencidaA !== vencidaB) return vencidaA ? -1 : 1;
  const orden = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 };
  const prioridad = (orden[a.priority] ?? 1) - (orden[b.priority] ?? 1);
  if (prioridad) return prioridad;
  return (a.dueDate || Infinity) - (b.dueDate || Infinity) || (a.position ?? Infinity) - (b.position ?? Infinity) || b.createdAt - a.createdAt;
};
