import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CarteraExportData, CarteraFacturaRow } from './finance-exports';

const NAVY: [number, number, number] = [3, 29, 51];
const BLUE: [number, number, number] = [0, 101, 167];
const INK: [number, number, number] = [7, 26, 46];
const PALE: [number, number, number] = [235, 242, 248];
const money = (value: number) => '$ ' + value.toLocaleString('es-CO', { maximumFractionDigits: 2 });

async function logoData() {
  try {
    const response = await fetch('/img/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function documentDetail(row: CarteraFacturaRow): string {
  const description = row.description || 'Sin descripción registrada';
  const payments = (row.payments || []).map((payment) => {
    const detail = [payment.notes || 'Sin descripción registrada', payment.method, payment.reference].filter(Boolean).join(' · ');
    return `${payment.fecha || 'Fecha no registrada'} | $ ${payment.amount.toLocaleString('es-CO', { maximumFractionDigits: 2 })} | ${detail}`;
  });
  return payments.length ? `${description}\n\nABONOS APLICADOS\n${payments.join('\n')}` : description;
}

export async function renderCarteraPdf(data: CarteraExportData) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 8;
  const usable = width - margin * 2;
  const logo = await logoData();
  let client = data.vista === 'cliente' ? data.clientName : 'Todos los clientes';
  let nit = data.vista === 'cliente' ? data.clientNit : '';
  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, width, 35, 'F');
    doc.setFillColor(5, 48, 79); doc.triangle(width - 45, 35, width - 6, 3, width - 4, 35, 'F');
    doc.setFillColor(0, 105, 171); doc.triangle(width - 35, 35, width - 6, 3, width - 17, 35, 'F');
    if (logo) doc.addImage(logo, 'PNG', 10, 6, 73, 21);
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(23); doc.setTextColor(255,255,255); doc.text('DT GROWTH PARTNERS', 10, 19); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(200,216,232);
    doc.text('E S T R A T E G I A   ·   T E C N O L O G I A   ·   R E S U L T A D O S', 11, 31);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...INK); doc.text('ESTADO DE', margin, 49);
    doc.setTextColor(...BLUE); doc.text('CARTERA', margin + doc.getTextWidth('ESTADO DE '), 49);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(91,116,146); doc.text('C U E N T A S   P O R   C O B R A R', margin + 1, 56);
    doc.setFillColor(...PALE); doc.roundedRect(147, 41, width - 155, 24, 2, 2, 'F');
    doc.setFontSize(7); doc.text('CLIENTE', 152, 46); doc.text('CORTE AL', 234, 46);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.setFontSize(9);
    doc.text(doc.splitTextToSize(client, 76).slice(0, 2), 152, 51);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(nit ? `NIT ${nit}` : 'Cartera consolidada', 152, 61);
    doc.text(doc.splitTextToSize(data.periodLabel, 47).slice(0, 3), 234, 51);
  };
  const table = (head: string[][], body: (string | number)[][], startY: number, foot?: (string | number)[][], detail = false) => {
    autoTable(doc, {
      startY, head, body, foot, rowPageBreak: 'avoid', theme: 'grid', showFoot: 'lastPage',
      margin: { left: margin, right: margin, top: 73, bottom: 44 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, valign: 'top', overflow: 'linebreak', textColor: INK, lineColor: [215,225,236], lineWidth: 0.15, minCellHeight: 14 },
      headStyles: { fillColor: BLUE, textColor: [255,255,255], fontStyle: 'bold', minCellHeight: 16, valign: 'middle' },
      footStyles: { fillColor: [220,234,245], textColor: INK, fontStyle: 'bold', minCellHeight: 13 },
      alternateRowStyles: { fillColor: [246,249,252] },
      columnStyles: detail ? { 0: { cellWidth: 40 }, 1: { cellWidth: 23 }, 2: { cellWidth: 80 }, 3: { cellWidth: 34, halign: 'right' }, 4: { cellWidth: 34, halign: 'right' }, 5: { cellWidth: 35, halign: 'right' }, 6: { cellWidth: usable - 246, halign: 'center' } } : {},
      didParseCell: (cell) => {
        if (detail && cell.section === 'body' && cell.column.index === 6) {
          cell.cell.styles.fillColor = cell.cell.raw === 'Parcial' ? [224,245,237] : [255,242,206];
          cell.cell.styles.textColor = cell.cell.raw === 'Parcial' ? [18,107,65] : [155,94,0];
          cell.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: header,
    });
    return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  };
  const cards = (start: number, total: number, paid: number, balance: number, status: string) => {
    let y = start + 6;
    if (y + 23 > height - 44) { doc.addPage(); header(); y = 73; }
    const gap = 5; const w = (usable - gap * 3) / 4;
    ['TOTAL FACTURADO', 'TOTAL ABONADO', 'SALDO ACTUAL', 'ESTADO'].forEach((label, i) => {
      const x = margin + (w + gap) * i;
      doc.setDrawColor(217,230,241); doc.setFillColor(255,255,255); doc.roundedRect(x, y, w, 23, 2, 2, 'FD');
      doc.setFillColor(...(i === 1 ? [226,246,237] : i === 3 ? [255,245,220] : [227,241,252]) as [number,number,number]);
      doc.circle(x + 9, y + 11.5, 5.7, 'F');
      doc.setTextColor(...BLUE); doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text(i === 1 ? '$' : i === 3 ? '!' : i === 2 ? '=' : '#', x + 7.6, y + 13);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(42,73,107); doc.text(label,x+18,y+7);
      doc.setFont('helvetica','bold'); doc.setFontSize(i === 3 ? 11 : 15); doc.setTextColor(...INK);
      doc.text(i === 3 ? status : money([total,paid,balance][i]), x+18,y+16);
    });
    return y + 23;
  };
  const documents = data.facturas || [];
  if (data.vista === 'general') {
    header();
    const y = table([['Cliente', 'NIT', 'Documentos', 'Antigüedad', 'Saldo pendiente']], data.clientes.map((row) => [row.clientName,row.nit,row.facturas,row.bucketLabel,money(row.saldo)]),73,
      [['TOTAL CARTERA','','','',money(data.totalCartera)]]);
    cards(y, documents.reduce((s,r)=>s+r.totalAmount,0),documents.reduce((s,r)=>s+r.paidAmount,0),data.totalCartera,'Por cobrar');
  }
  const groups = new Map<string, CarteraFacturaRow[]>();
  documents.forEach((row) => { const key = `${row.clientName || client}|${row.clientNit || nit}`; groups.set(key,[...(groups.get(key)||[]),row]); });
  let index = 0;
  for (const rows of groups.values()) {
    if (data.vista === 'general' || index++) doc.addPage();
    client = rows[0].clientName || client; nit = rows[0].clientNit || nit; header();
    const total=rows.reduce((s,r)=>s+r.totalAmount,0), paid=rows.reduce((s,r)=>s+r.paidAmount,0), balance=rows.reduce((s,r)=>s+r.saldo,0);
    const y = table([['Documento / Tipo','Fecha','Descripción','Valor','Abonado','Saldo','Estado']], rows.map((row)=>[`${row.invoiceNumber}\n${row.tipoDocumento}`,row.fecha,documentDetail(row),money(row.totalAmount),money(row.paidAmount),money(row.saldo),row.statusLabel]),73,
      [['TOTALES','','',money(total),money(paid),money(balance),'']],true);
    cards(y,total,paid,balance,paid > 0 ? 'Parcial' : 'Pendiente');
  }
  if (!documents.length && data.vista === 'cliente') { header();doc.setFontSize(11);doc.text('No hay documentos con saldo pendiente.',margin,80); }
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setFillColor(...PALE);doc.roundedRect(margin,height-34,usable,23,2,2,'F');
    doc.setTextColor(...NAVY);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('¿Dudas o necesitas soporte?',margin+6,height-26);doc.text('Contáctanos',172,height-26);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Estamos atentos para cualquier consulta relacionada con tu cuenta.',margin+6,height-19);doc.text('administracion@dtgrowthpartners.com',172,height-19);
    doc.setDrawColor(206,222,235);doc.line(margin,height-8,width-margin,height-8);doc.setFontSize(6.5);doc.setTextColor(63,94,128);
    doc.text('CARTAGENA, COLOMBIA  |  DTGROWTHPARTNERS.COM',margin,height-4);doc.text(`CONVERTIMOS ESTRATEGIAS EN RESULTADOS   ·   ${page}/${pages}`,width-margin,height-4,{align:'right'});
  }
  const suffix=data.vista==='cliente'?data.clientName.replace(/\s+/g,'_'):'General';
  doc.save(`Cartera_${suffix}.pdf`);
}
