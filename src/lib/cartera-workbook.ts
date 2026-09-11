import type { CarteraExportData } from './finance-exports';
import * as XLSX from 'xlsx-js-style';

const BLUE = '0D5C9D';
const INK = '172B4D';
const PALE = 'E6EEF8';
const money = '"$" #,##0.00;[Red]("$" #,##0.00);"$" 0.00';
type Value = string | number;

export function buildCarteraWorkbook(data: CarteraExportData) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: 'Estado de cartera', Author: 'DT Growth Partners', Company: 'DT Growth Partners' };
  const scope = data.vista === 'general' ? 'Todos los clientes con saldo pendiente' : `${data.clientName} | NIT ${data.clientNit || 'No registrado'}`;
  function sheet(name: string, headers: string[], rows: Value[][], widths: number[], moneyCols: number[], totals?: Value[]) {
    const last = headers.length - 1;
    const values: Value[][] = [ ['DT GROWTH PARTNERS'], ['ESTADO DE CARTERA | ' + name.toUpperCase()], [scope], ['Corte: ' + data.periodLabel], [], headers, ...rows ];
    if (totals) values.push(totals);
    const ws = XLSX.utils.aoa_to_sheet(values);
    ws['!merges'] = [0, 1, 2, 3].map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: last } }));
    ws['!cols'] = widths.map((wch) => ({ wch }));
    ws['!rows'] = values.map((row, index) => ({ hpt: index === 0 ? 32 : index < 4 ? 25 : index === 5 ? 32 : Math.max(28, ...row.map((value, c) => 15 * String(value).split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (widths[c] || 25))), 0) + 10)) }));
    if (rows.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + rows.length, c: last } }) };
    for (let r = 0; r < values.length; r++) for (let c = 0; c <= last; c++) {
      const key = XLSX.utils.encode_cell({ r, c });
      const cell = ws[key] || (ws[key] = { t: 's', v: '' });
      const heading = r < 2 || r === 5;
      const total = Boolean(totals && r === values.length - 1);
      cell.s = {
        font: { name: 'Calibri', sz: r === 0 ? 19 : 11, bold: heading || total, color: { rgb: heading ? 'FFFFFF' : INK } },
        fill: { patternType: 'solid', fgColor: { rgb: heading ? BLUE : total ? PALE : r > 5 && r % 2 === 0 ? 'F4F7FB' : 'FFFFFF' } },
        alignment: { vertical: 'top', horizontal: r >= 6 && moneyCols.includes(c) ? 'right' : 'left', wrapText: true },
        border: r >= 5 ? { bottom: { style: total ? 'medium' : 'hair', color: { rgb: total ? BLUE : 'D8E1EB' } } } : {},
      };
      if (r >= 6 && typeof cell.v === 'number' && moneyCols.includes(c)) cell.z = money;
    }
    XLSX.utils.book_append_sheet(workbook, ws, name);
  }
  if (data.vista === 'general') {
    sheet('Resumen', ['Cliente', 'NIT', 'Documentos', 'Antigüedad', 'Saldo pendiente'],
      data.clientes.map((client) => [client.clientName, client.nit, client.facturas, client.bucketLabel, client.saldo]),
      [38, 20, 14, 20, 23], [4], ['TOTAL CARTERA', '', '', '', data.totalCartera]);
  }
  const documents = data.facturas || [];
  const total = (field: 'totalAmount' | 'paidAmount' | 'saldo') => documents.reduce((sum, row) => sum + row[field], 0);
  sheet('Documentos', ['Cliente', 'N° documento', 'Tipo', 'Fecha', 'Descripción', 'Valor documento', 'Abonos aplicados', 'Saldo pendiente', 'Estado'],
    documents.map((row) => [row.clientName || (data.vista === 'cliente' ? data.clientName : ''), row.invoiceNumber, row.tipoDocumento, row.fecha, row.description || 'Sin descripción registrada', row.totalAmount, row.paidAmount, row.saldo, row.statusLabel]),
    [30, 25, 23, 16, 64, 22, 22, 22, 16], [5, 6, 7], ['TOTALES', '', '', '', '', total('totalAmount'), total('paidAmount'), total('saldo'), '']);
  const payments = documents.flatMap((row) => (row.payments || []).map((payment) => [row.clientName || (data.vista === 'cliente' ? data.clientName : ''), row.invoiceNumber, payment.fecha, payment.amount, payment.method, payment.reference, payment.notes]));
  sheet('Abonos', ['Cliente', 'N° documento', 'Fecha de abono', 'Valor aplicado', 'Medio de pago', 'Referencia', 'Observaciones'], payments,
    [30, 25, 23, 22, 23, 32, 64], [3]);
  return workbook;
}
