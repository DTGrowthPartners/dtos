// Filtros financieros compartidos.
//
// Categorías que NO entran en el Estado de Resultados (utilidad real del negocio):
// traslados entre cuentas, reembolsos, reservas y ajustes de saldo. El Dashboard
// (tarjetas de Ingresos/Gastos/Beneficio) usa este MISMO filtro para que sus
// cifras coincidan con Finanzas → Reportes → Estado de Resultados.
export const isExcludedCategory = (categoria: string | undefined | null): boolean => {
  if (!categoria) return false;
  const upper = categoria.trim().toUpperCase();
  return (
    upper === 'AJUSTE SALDO' ||
    upper === 'RESERVAS' ||
    upper.startsWith('TRASLADO') ||
    upper.startsWith('REEMBOLSO')
  );
};
