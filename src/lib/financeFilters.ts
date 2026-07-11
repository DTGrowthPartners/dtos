// Filtros financieros compartidos.
//
// Usados por Finanzas → Reportes (Gastos, Entradas, Estado de Resultados) y por
// el Dashboard, para que las cifras de Ingresos/Gastos/Beneficio coincidan entre
// todas las vistas de la app.

// Filtro de Finanzas → Reportes → Gastos: incluye TODAS las categorías de
// Salidas excepto esta lista explícita.
export const isExcludedExpenseReportCategory = (
  categoria: string | undefined | null,
  descripcion?: string | null
): boolean => {
  // "Reembolso Dairo" se registra sin categoría en Salidas, así que se excluye
  // por descripción (mismo criterio que REEMBOLSOS/REEMBOLSO INVERSIÓN PUBLICIDAD).
  if (descripcion && descripcion.trim().toUpperCase() === 'REEMBOLSO DAIRO') return true;
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  if (
    upper === 'REEMBOLSO INVERSIÓN PUBLICIDAD' ||
    upper === 'REEMBOLSOS' ||
    upper === 'TRASLADO CUENTA DAIRO' ||
    upper === 'CUENTAS POR COBRAR A EMPLEADOS (CUENTA)'
  ) return true;
  // "Cuentas por Cobrar/Pagar a Socios" — cubre ambas variantes de redacción
  if (upper.includes('SOCIOS') && (upper.includes('COBRAR') || upper.includes('PAGAR'))) return true;
  return false;
};

// Filtro de Finanzas → Reportes → Entradas: SOLO se incluyen estas categorías
// (lista de inclusión, no de exclusión — todo lo demás en Entradas se descarta,
// incluyendo categorías no contempladas como "REEMBOLSO").
const INCOME_REPORT_ALLOWED = new Set(['PAGO DE CLIENTE', 'FINANCIEROS']);
export const isExcludedIncomeReportCategory = (categoria: string | undefined | null): boolean => {
  if (!categoria) return true;
  const upper = categoria.trim().toUpperCase();
  return !INCOME_REPORT_ALLOWED.has(upper);
};
