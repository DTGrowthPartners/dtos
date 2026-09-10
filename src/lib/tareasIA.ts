import { Priority, type Task } from '@/types/taskTypes';

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
