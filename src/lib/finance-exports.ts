import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ============================================================
// DATOS DE LA EMPRESA
// ============================================================

const COMPANY_NAME = 'DT GROWTH PARTNERS';
const COMPANY_NIT = 'NIT.: 1.143.397.563-9';
const LOGO_PATH = '/img/logo.png';

const REP_LEGAL_TITLE = 'Representante Legal';
const REP_LEGAL_NAME = 'DAIRO ALBERTO TRASLAVIÑA TORRES';
const REP_LEGAL_CC = 'C.C. 1.143.397.563';

const CONTADOR_TITLE = 'Contador Público';
const CONTADOR_NAME = 'JHONATAN DE JESÚS PORTO MARTÍNEZ';
const CONTADOR_CC = 'C.C.: 1.143.404.396';
const CONTADOR_TP = 'T.P.: 282454-T';

// Brand blue from DT logo
const BRAND_BLUE: [number, number, number] = [13, 92, 157];

// ============================================================
// HELPERS
// ============================================================

const fmtNum = (v: number) =>
  Math.round(v).toLocaleString('es-CO');

type CellDef = string | { content: string; styles?: Record<string, unknown> };
type RowDef = CellDef[];

const DARK = [35, 35, 35];
const LIGHT_BG = [247, 247, 250];
const ACCENT_BG = [230, 238, 248];
const LINE_COLOR = [210, 210, 215];

const bold = (text: string, extra?: Record<string, unknown>): CellDef => ({
  content: text,
  styles: { fontStyle: 'bold', ...extra },
});

const right = (text: string, extra?: Record<string, unknown>): CellDef => ({
  content: text,
  styles: { halign: 'right' as const, ...extra },
});

const boldRight = (text: string, extra?: Record<string, unknown>): CellDef => ({
  content: text,
  styles: { fontStyle: 'bold', halign: 'right' as const, ...extra },
});

// Fetch logo as base64
async function fetchLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch(LOGO_PATH);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ---- Shared PDF header with logo ----
async function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Blue header bar
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pw, 28, 'F');

  // Logo on blue bar — original is 2000x564 (ratio 3.55:1)
  const logo = await fetchLogoBase64();
  if (logo) {
    try {
      const logoH = 12;
      const logoW = logoH * 3.55; // ~42.6mm to keep aspect ratio
      const logoY = (28 - logoH) / 2; // vertically centered in bar
      doc.addImage(logo, 'PNG', 14, logoY, logoW, logoH);
    } catch { /* ignore if logo fails */ }
  }

  // Company name on blue bar (right-aligned, white)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY_NAME, pw - 16, 13, { align: 'right' });

  // NIT on blue bar
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 240);
  doc.text(COMPANY_NIT, pw - 16, 19, { align: 'right' });

  // Title below bar
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(35, 35, 35);
  doc.text(title, pw / 2, 37, { align: 'center' });

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, pw / 2, 43, { align: 'center' });

  // Reset
  doc.setTextColor(35, 35, 35);
}

// ---- Shared PDF signatures ----
function drawSignatures(doc: jsPDF, startY: number) {
  const pw = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = startY + 25;

  if (y + 25 > pageH - 15) {
    doc.addPage();
    y = 40;
  }

  doc.setDrawColor(120, 120, 125);
  doc.setLineWidth(0.25);

  // Left — Rep Legal
  const lx = 58;
  doc.line(lx - 38, y, lx + 38, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(35, 35, 35);
  doc.text(REP_LEGAL_TITLE, lx, y + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(REP_LEGAL_NAME, lx, y + 9, { align: 'center' });
  doc.text(REP_LEGAL_CC, lx, y + 13, { align: 'center' });

  // Right — Contador
  const rx = pw - 58;
  doc.line(rx - 38, y, rx + 38, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(35, 35, 35);
  doc.text(CONTADOR_TITLE, rx, y + 4.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(CONTADOR_NAME, rx, y + 9, { align: 'center' });
  doc.text(CONTADOR_CC, rx, y + 13, { align: 'center' });
  doc.text(CONTADOR_TP, rx, y + 17, { align: 'center' });
}

// ============================================================
// ESTADO DE RESULTADOS
// ============================================================

export interface IncomeStatementExportData {
  periodLabel: string;
  totalIngresos: number;
  totalGastos: number;
  utilidadBruta: number;
  margenBruto: number;
  comisionParticipacion: number;
  dividendosDairo: number;
  reservaEmpresa: number;
  sueldoDairo: number;
  totalDairo: number;
}

// ---------- PDF ----------

export async function exportIncomeStatementPDF(data: IncomeStatementExportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  await drawHeader(doc, 'ESTADO DE RESULTADOS', `Con corte a ${data.periodLabel}`);

  const pct = `${data.margenBruto.toFixed(2)}%`;
  const hasComision = data.comisionParticipacion > 0;
  const utilidadNeta = data.utilidadBruta - data.comisionParticipacion;

  const rows: RowDef[] = [
    [bold('(+)  Ingresos'), boldRight(fmtNum(data.totalIngresos))],                              // 0
    ['       Ventas y prestación de servicios', right(fmtNum(data.totalIngresos))],               // 1
    [bold('(-)  Costos y gastos'), boldRight(fmtNum(data.totalGastos))],                          // 2
    ['       Costos de venta y prestación de servicios', right(fmtNum(data.totalGastos))],        // 3
    ['', ''],                                                                                      // 4
    [bold(`(=)  Utilidad Bruta  (${pct})`), boldRight(fmtNum(data.utilidadBruta))],               // 5
  ];

  let rowIdx = 6;
  const totalRows = [0, 2, 5];
  const accentRows = [5];

  if (hasComision) {
    rows.push(['(-)  Comisión / Participación (1%)', right(fmtNum(data.comisionParticipacion))]); // 6
    rows.push([bold('(=)  Utilidad Neta después de Comisión'), boldRight(fmtNum(utilidadNeta))]); // 7
    totalRows.push(rowIdx + 1);
    accentRows.push(rowIdx + 1);
    rowIdx += 2;
  }

  rows.push(['', '']); rowIdx++;
  rows.push([bold('Distribución de Utilidad', { textColor: [100, 100, 100] }), '']); rowIdx++;
  rows.push(['       Dividendos Socio (25%)', right(fmtNum(data.dividendosDairo))]); rowIdx++;
  rows.push(['       Reserva Empresa (75%)', right(fmtNum(data.reservaEmpresa))]); rowIdx++;
  rows.push(['       Nómina (Dairo)', right(fmtNum(data.sueldoDairo))]); rowIdx++;
  rows.push(['', '']); rowIdx++;
  const totalSocioIdx = rowIdx;
  rows.push([bold('(=)  Total Socio (Sueldo + Dividendos)'), boldRight(fmtNum(data.totalDairo))]); rowIdx++;
  const utilNetaIdx = rowIdx;
  rows.push([bold('(=)  Utilidad Neta (Reserva Empresa)'), boldRight(fmtNum(data.reservaEmpresa))]); rowIdx++;

  totalRows.push(totalSocioIdx, utilNetaIdx);
  accentRows.push(utilNetaIdx);

  autoTable(doc, {
    startY: 48,
    head: [[
      { content: '', styles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } },
      { content: data.periodLabel, styles: { halign: 'right' as const, fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } },
    ]],
    body: rows as unknown as autoTable.RowInput[],
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 5, right: 5 },
      lineColor: LINE_COLOR,
      lineWidth: 0.1,
      textColor: DARK,
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 40 },
    },
    didParseCell(hookData) {
      if (hookData.section !== 'body') return;
      const i = hookData.row.index;
      if (accentRows.includes(i)) {
        hookData.cell.styles.fillColor = ACCENT_BG;
        hookData.cell.styles.lineWidth = { top: 0.5, bottom: 0.1, left: 0.1, right: 0.1 } as unknown as number;
        hookData.cell.styles.lineColor = { top: BRAND_BLUE, bottom: LINE_COLOR, left: LINE_COLOR, right: LINE_COLOR } as unknown as number;
      } else if (totalRows.includes(i)) {
        hookData.cell.styles.fillColor = LIGHT_BG;
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  drawSignatures(doc, finalY);

  doc.save(`Estado_Resultados_${data.periodLabel.replace(/\s+/g, '_')}.pdf`);
}

// ---------- Excel ----------

export function exportIncomeStatementExcel(data: IncomeStatementExportData) {
  const hasComision = data.comisionParticipacion > 0;
  const utilidadNeta = data.utilidadBruta - data.comisionParticipacion;

  const rows: (string | number | null)[][] = [
    [COMPANY_NAME],
    [COMPANY_NIT],
    ['ESTADO DE RESULTADOS'],
    [`Con corte a ${data.periodLabel}`],
    [],
    ['', data.periodLabel],
    ['(+) Ingresos', data.totalIngresos],
    ['     Ventas y prestación de servicios', data.totalIngresos],
    ['(-) Costos y gastos', data.totalGastos],
    ['     Costos de venta y prestación de servicios', data.totalGastos],
    [],
    [`(=) Utilidad Bruta (${data.margenBruto.toFixed(2)}%)`, data.utilidadBruta],
  ];

  if (hasComision) {
    rows.push(['(-) Comisión / Participación (1%)', data.comisionParticipacion]);
    rows.push([`(=) Utilidad Neta después de Comisión`, utilidadNeta]);
  }

  rows.push(
    [],
    ['Distribución de Utilidad'],
    ['     Dividendos Socio (25%)', data.dividendosDairo],
    ['     Reserva Empresa (75%)', data.reservaEmpresa],
    ['     Nómina (Dairo)', data.sueldoDairo],
    [],
    ['(=) Total Socio (Sueldo + Dividendos)', data.totalDairo],
    ['(=) Utilidad Neta (Reserva Empresa)', data.reservaEmpresa],
    [],
    [],
    [REP_LEGAL_TITLE, '', CONTADOR_TITLE],
    [REP_LEGAL_NAME, '', CONTADOR_NAME],
    [REP_LEGAL_CC, '', CONTADOR_CC],
    ['', '', CONTADOR_TP],
  );

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 48 }, { wch: 22 }, { wch: 42 }];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 5; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell && typeof cell.v === 'number') {
      cell.t = 'n';
      cell.z = '#,##0';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Estado de Resultados');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Estado_Resultados_${data.periodLabel.replace(/\s+/g, '_')}.xlsx`);
}

// ============================================================
// ESTADO DE SITUACIÓN FINANCIERA
// ============================================================

export interface BalanceSheetExportData {
  periodLabel: string;
  disponible: { cuenta: string; saldo: number }[];
  totalDisponible: number;
  cuentasPorCobrar: { clientName: string; saldo: number }[];
  totalCuentasPorCobrar: number;
  totalActivos: number;
  cuentasPorPagar: { cliente: string; saldo: number }[];
  totalPasivos: number;
  utilidadEjercicio: number;
  utilidadEjerciciosAnteriores: number;
  totalPatrimonio: number;
}

// ---------- PDF ----------

export async function exportBalanceSheetPDF(data: BalanceSheetExportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  await drawHeader(doc, 'ESTADO DE SITUACIÓN FINANCIERA', `Con corte a ${data.periodLabel}`);

  const rows: RowDef[] = [];
  const totalRowIndices: number[] = [];
  const accentRowIndices: number[] = [];
  const sectionIndices: number[] = [];
  let i = 0;

  // =============== ACTIVOS ===============
  rows.push([bold('ACTIVO TOTAL'), boldRight(fmtNum(data.totalActivos))]);
  accentRowIndices.push(i); totalRowIndices.push(i); i++;

  rows.push([bold('  Activo Corriente'), boldRight(fmtNum(data.totalActivos))]);
  sectionIndices.push(i); i++;

  // Efectivo - SIN detalle, solo total
  rows.push(['      Efectivo y equivalentes de efectivo', right(fmtNum(data.totalDisponible))]);
  i++;

  // Deudores - SIN detalle, solo total acumulado
  rows.push(['      Deudores comerciales y otros', right(fmtNum(data.totalCuentasPorCobrar))]);
  i++;

  rows.push(['', '']); i++;

  // =============== PASIVO Y PATRIMONIO ===============
  rows.push([bold('PASIVO Y PATRIMONIO'), boldRight(fmtNum(data.totalPasivos + data.totalPatrimonio))]);
  accentRowIndices.push(i); totalRowIndices.push(i); i++;

  rows.push([bold('  Pasivo Total'), boldRight(fmtNum(data.totalPasivos))]);
  sectionIndices.push(i); i++;

  rows.push([bold('      Pasivo Corriente'), boldRight(fmtNum(data.totalPasivos))]);
  i++;

  // Acreedores - solo el valor, sin detalle individual
  rows.push(['          Acreedores', right(fmtNum(data.totalPasivos))]);
  i++;

  rows.push(['', '']); i++;

  // Patrimonio
  rows.push([bold('  Patrimonio neto'), boldRight(fmtNum(data.totalPatrimonio))]);
  sectionIndices.push(i); i++;

  rows.push(['      Resultado del ejercicio actual', right(fmtNum(data.utilidadEjercicio))]);
  i++;

  rows.push(['      Resultado de ejercicios anteriores', right(fmtNum(data.utilidadEjerciciosAnteriores))]);
  i++;

  autoTable(doc, {
    startY: 48,
    head: [[
      { content: '', styles: { fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } },
      { content: data.periodLabel, styles: { halign: 'right' as const, fillColor: BRAND_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } },
    ]],
    body: rows as unknown as autoTable.RowInput[],
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 },
      lineColor: LINE_COLOR,
      lineWidth: 0.1,
      textColor: DARK,
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 40 },
    },
    didParseCell(hookData) {
      if (hookData.section !== 'body') return;
      const idx = hookData.row.index;
      if (accentRowIndices.includes(idx)) {
        hookData.cell.styles.fillColor = ACCENT_BG;
        hookData.cell.styles.lineWidth = { top: 0.5, bottom: 0.15, left: 0.1, right: 0.1 } as unknown as number;
        hookData.cell.styles.lineColor = { top: BRAND_BLUE, bottom: LINE_COLOR, left: LINE_COLOR, right: LINE_COLOR } as unknown as number;
      } else if (totalRowIndices.includes(idx)) {
        hookData.cell.styles.fillColor = LIGHT_BG;
      } else if (sectionIndices.includes(idx)) {
        hookData.cell.styles.fillColor = [252, 252, 254];
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Verification line — sin espacios
  const diff = Math.abs(data.totalActivos - (data.totalPasivos + data.totalPatrimonio));
  const checkText = diff < 1
    ? `Activos ($${fmtNum(data.totalActivos)}) = Pasivos ($${fmtNum(data.totalPasivos)}) + Patrimonio ($${fmtNum(data.totalPatrimonio)})`
    : `Diferencia de cuadre: $${fmtNum(diff)}`;

  const checkY = finalY + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(diff < 1 ? 40 : 180, diff < 1 ? 130 : 50, diff < 1 ? 70 : 50);
  doc.text(diff < 1 ? `✓  ${checkText}` : `⚠  ${checkText}`, 20, checkY);
  doc.setTextColor(35, 35, 35);

  drawSignatures(doc, checkY + 5);

  doc.save(`Situacion_Financiera_${data.periodLabel.replace(/\s+/g, '_')}.pdf`);
}

// ---------- Excel ----------

export function exportBalanceSheetExcel(data: BalanceSheetExportData) {
  const diff = Math.abs(data.totalActivos - (data.totalPasivos + data.totalPatrimonio));
  const checkText = diff < 1
    ? `Activos ($${fmtNum(data.totalActivos)}) = Pasivos ($${fmtNum(data.totalPasivos)}) + Patrimonio ($${fmtNum(data.totalPatrimonio)})`
    : `Diferencia de cuadre: $${fmtNum(diff)}`;

  const rows: (string | number | null)[][] = [
    [COMPANY_NAME],
    [COMPANY_NIT],
    ['ESTADO DE SITUACIÓN FINANCIERA'],
    [`Con corte a ${data.periodLabel}`],
    [],
    ['', data.periodLabel],
    ['ACTIVO TOTAL', data.totalActivos],
    ['  Activo Corriente', data.totalActivos],
    ['      Efectivo y equivalentes de efectivo', data.totalDisponible],
    ['      Deudores comerciales y otros', data.totalCuentasPorCobrar],
    [],
    ['PASIVO Y PATRIMONIO', data.totalPasivos + data.totalPatrimonio],
    ['  Pasivo Total', data.totalPasivos],
    ['      Pasivo Corriente', data.totalPasivos],
    ['          Acreedores', data.totalPasivos],
    [],
    ['  Patrimonio neto', data.totalPatrimonio],
    ['      Resultado del ejercicio actual', data.utilidadEjercicio],
    ['      Resultado de ejercicios anteriores', data.utilidadEjerciciosAnteriores],
    [],
    [checkText],
    [],
    [REP_LEGAL_TITLE, '', CONTADOR_TITLE],
    [REP_LEGAL_NAME, '', CONTADOR_NAME],
    [REP_LEGAL_CC, '', CONTADOR_CC],
    ['', '', CONTADOR_TP],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 48 }, { wch: 22 }, { wch: 42 }];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 5; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cell && typeof cell.v === 'number') {
      cell.t = 'n';
      cell.z = '#,##0';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Situación Financiera');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Situacion_Financiera_${data.periodLabel.replace(/\s+/g, '_')}.xlsx`);
}
