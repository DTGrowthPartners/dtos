/**
 * Razones por las que se pierde un prospecto.
 *
 * El `value` es lo que queda guardado en el prospecto y lo que agrupa el reporte
 * de "Razones de pérdida": no se cambia en las que ya existen o se parten las
 * estadísticas históricas. Agregar una nueva sí es seguro.
 *
 * Vive aquí y no en la página porque la usan el diálogo de marcar perdido, el
 * archivo del pipeline y el reporte: tenerla escrita en cada lado hacía que
 * agregar una razón la dejara sin nombre en las otras vistas.
 */
export interface LostReason {
  value: string;
  label: string;
}

export const LOST_REASONS: LostReason[] = [
  { value: 'precio', label: 'Precio muy alto' },
  // No es lo mismo que "precio": ahí el precio es el problema; aquí simplemente
  // no hay plata ahora. Separarlas dice si hay que ajustar la oferta o volver
  // a buscar al prospecto más adelante.
  { value: 'sin_presupuesto', label: 'No tiene presupuesto' },
  { value: 'competencia', label: 'Eligió competencia' },
  { value: 'timing', label: 'No es el momento' },
  { value: 'no_necesita', label: 'No necesita el servicio' },
  { value: 'sin_respuesta', label: 'No respondió' },
  { value: 'no_califica', label: 'No califica como cliente' },
  { value: 'otro', label: 'Otro' },
];

/** El prospecto guarda el value ('sin_presupuesto'); para mostrarlo hace falta el texto. */
export const razonPerdida = (value?: string | null): string =>
  LOST_REASONS.find((r) => r.value === value)?.label || value || '';
