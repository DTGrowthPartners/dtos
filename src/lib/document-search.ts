export interface SearchDocument {
  id: string; invoiceNumber: string; factusNumber?: string | null;
  clientName: string; clientNit?: string; tipoDocumento?: string;
  fecha: string; concepto?: string | null; servicio?: string | null;
  totalAmount: number; paidAmount?: number; status: string;
}
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function filterDocuments(rows: SearchDocument[], client: string, number: string, type: string) {
  const clientKey = normalized(client), numberKey = normalized(number);
  return rows.filter(row => (!clientKey || [row.clientName, row.clientNit].some(value => normalized(value || '').includes(clientKey)))
    && (!numberKey || [row.invoiceNumber, row.factusNumber].some(value => normalized(value || '').includes(numberKey)))
    && (!type || (row.tipoDocumento || 'cuenta_cobro') === type));
}
