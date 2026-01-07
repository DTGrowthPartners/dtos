/**
 * Formatea un timestamp a una fecha en formato DD/MM/YYYY.
 * @param timestamp - El timestamp a formatear.
 * @returns La fecha formateada o un string vacío si el timestamp es inválido.
 */
export const formatDate = (timestamp: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Formatea un timestamp a una fecha relativa (ej: "Hace 2 días", "En 3 días").
 * @param timestamp - El timestamp a formatear.
 * @returns La fecha relativa o un string vacío si el timestamp es inválido.
 */
export const formatRelativeDate = (timestamp: number): string => {
  if (!timestamp) return '';

  const now = new Date();
  const date = new Date(timestamp);
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays === -1) return "Ayer";

  if (diffDays > 1) return `En ${diffDays} días`;
  if (diffDays < -1) return `Hace ${Math.abs(diffDays)} días`;

  return formatDate(timestamp);
};

/**
 * Verifica si una tarea está vencida.
 * @param dueDate - El timestamp de la fecha de vencimiento.
 * @returns `true` si la tarea está vencida, `false` en caso contrario.
 */
export const isOverdue = (dueDate: number): boolean => {
  if (!dueDate) return false;
  const now = new Date().setHours(0, 0, 0, 0);
  return dueDate < now;
};

/**
 * Verifica si una tarea vence pronto (en los próximos 2 días).
 * @param dueDate - El timestamp de la fecha de vencimiento.
 * @returns `true` si la tarea vence pronto, `false` en caso contrario.
 */
export const isDueSoon = (dueDate: number): boolean => {
  if (!dueDate) return false;
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  return dueDate >= now.getTime() && dueDate <= twoDaysFromNow.getTime();
};

/**
 * Obtiene el color del badge de la fecha según el estado de la tarea.
 * @param dueDate - El timestamp de la fecha de vencimiento.
 * @param status - El estado de la tarea.
 * @returns Las clases de Tailwind para el color del badge.
 */
export const getDateBadgeColor = (dueDate: number | undefined, status: string): string => {
  if (status === 'DONE') {
    return 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30';
  }
  if (dueDate) {
    if (isOverdue(dueDate)) {
      return 'bg-red-900/30 text-red-400 border border-red-500/30';
    }
    if (isDueSoon(dueDate)) {
      return 'bg-amber-900/30 text-amber-400 border border-amber-500/30';
    }
    return 'bg-blue-900/30 text-blue-400 border border-blue-500/30';
  }
  return 'hidden'; // No mostrar badge si no hay fecha
};
