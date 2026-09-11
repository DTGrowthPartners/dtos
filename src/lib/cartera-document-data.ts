export interface CarteraPayment {
  fecha: string;
  amount: number;
  method: string;
  reference: string;
  notes: string;
}

export interface InvoiceExportSource {
  concepto?: string | null;
  servicio?: string | null;
  items?: { descripcion?: string }[] | null;
  paidAmount?: number;
  payments?: { amount: number; paidAt?: string; paymentMethod?: string | null; reference?: string | null; notes?: string | null }[];
}

export function invoiceDescription(invoice: InvoiceExportSource) {
  const items = Array.isArray(invoice.items) ? invoice.items.map((item) => item.descripcion || '') : [];
  const parts = [invoice.concepto || '', ...items].map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts)].join('\n') || invoice.servicio?.trim() || 'Sin descripción registrada';
}

export function invoicePayments(invoice: InvoiceExportSource, formatDate: (date: string) => string): CarteraPayment[] {
  const rows = (invoice.payments || []).filter((payment) => Number.isFinite(payment.amount) && payment.amount !== 0)
    .map((payment) => ({ fecha: payment.paidAt ? formatDate(payment.paidAt) : 'Sin fecha registrada',
      amount: payment.amount, method: payment.paymentMethod || '', reference: payment.reference || '', notes: payment.notes || '' }));
  const difference = Math.round(((invoice.paidAmount || 0) - rows.reduce((sum, payment) => sum + payment.amount, 0)) * 100) / 100;
  if (difference > 0) rows.push({ fecha: 'Sin fecha registrada', amount: difference, method: '', reference: '', notes: 'Abono acumulado sin desglose de movimientos' });
  if (difference < 0) rows.push({ fecha: '', amount: 0, method: '', reference: '', notes: 'El detalle de movimientos difiere del abonado acumulado; el saldo usa el abonado registrado en el documento.' });
  return rows;
}
