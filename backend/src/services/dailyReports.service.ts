import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from './googleSheets.service';

/**
 * Reportes diarios por correo (7:00 AM Bogotá) — port nativo de
 * api-cuentas-de-cobro/estado_resultados.py + cartera_report.py.
 *
 * 1. Estado de Resultados del mes en curso: ingresos por cliente (con detalle
 *    por día y No. de cuenta de cobro), gastos por categoría y utilidad.
 * 2. Estado de Cartera: cuentas de cobro sin pagar agrupadas por cliente,
 *    con días de mora y abonos.
 *
 * Se disparan vía POST /api/webhook/bot/reports/daily (cron del sistema).
 */

const prisma = new PrismaClient();

const TO = process.env.REPORTES_TO || 'Dairotras@gmail.com';
const CC = process.env.REPORTES_CC || 'jhonpm07@gmail.com';

const SPREADSHEET_ID = '1SKHZBmxEsZgKjoEx_p5QtyOy21Z0o9twIsWWlICmuzE';
const CREDENTIALS_PATH = path.join(__dirname, '../../..', 'credencials.json');

const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('en-US').replace(/,/g, '.');
const norm = (n: string | null | undefined) => (n || '').trim().replace(/[. ]+$/, '').toUpperCase();

const hoyBogota = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));

const transporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'gtxm1111.siteground.biz',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
});

async function enviar(subject: string, html: string) {
  const user = process.env.SMTP_USER || '';
  await transporter().sendMail({
    from: `"DT Growth Partners" <${user}>`,
    to: TO,
    cc: CC,
    subject,
    text: 'Reporte DT Growth Partners. Active la vista HTML para ver el detalle.',
    html,
  });
}

// ==================== Estado de Resultados ====================

// Variantes del mismo cliente que deben consolidarse en un solo item
const ALIAS_CLIENTES: Record<string, string> = {
  'SAN AUTOS': 'SAN AUTOS',
  SANAUTOS: 'SAN AUTOS',
  'ACBFIT SAS': 'ACBFIT SAS',
  ACBFIT: 'ACBFIT SAS',
};
const canonCliente = (nombre: string) => ALIAS_CLIENTES[norm(nombre)] || nombre;

const fmtFecha = (f: string) => {
  const m = f.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
};

/** Columnas 'No. Cuenta de Cobro' y 'Tercero' de la hoja Entradas, por número de fila */
async function mapasHojaEntradas(): Promise<{ ccMap: Map<number, string>; terMap: Map<number, string> }> {
  const ccMap = new Map<number, string>();
  const terMap = new Map<number, string>();
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Entradas!A1:L' });
    const vals = r.data.values || [];
    if (!vals.length) return { ccMap, terMap };
    const hdr = vals[0].map((h: string) => String(h).trim());
    const ccCol = hdr.indexOf('No. Cuenta de Cobro');
    const terCol = hdr.indexOf('Tercero');
    for (let i = 1; i < vals.length; i++) {
      const fila = i + 1; // fila real de la hoja (= rowIndex de getFinanceData)
      if (ccCol >= 0 && vals[i][ccCol]?.toString().trim()) ccMap.set(fila, vals[i][ccCol].toString().trim());
      if (terCol >= 0 && vals[i][terCol]?.toString().trim()) terMap.set(fila, vals[i][terCol].toString().trim());
    }
  } catch (e: any) {
    console.log(`[reportes] aviso: no se pudo leer la hoja Entradas: ${e?.message}`);
  }
  return { ccMap, terMap };
}

interface IngresoCliente { nombre: string; total: number; dias: { fecha: string; monto: number; ccs: string[] }[] }

export async function reporteEstadoResultados(): Promise<{ subject: string; html: string; resumen: string }> {
  const now = hoyBogota();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodoLabel = `${MESES_ES[now.getMonth()]} ${now.getFullYear()}`;
  const corte = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const financeData = await googleSheetsService.getFinanceData();
  const { ccMap, terMap } = await mapasHojaEntradas();

  // Ingresos: solo PAGO DE CLIENTE, agrupados por Tercero (con alias)
  const ing = new Map<string, IngresoCliente>();
  for (const t of financeData.ingresos) {
    const f = (t.fecha || '').slice(0, 10);
    if (!f.startsWith(periodo)) continue;
    const catNorm = norm(t.categoria);
    if (catNorm === 'REEMBOLSOS' || catNorm !== 'PAGO DE CLIENTE') continue;
    const rowIndex = (t as any).rowIndex as number;
    const tercero = (terMap.get(rowIndex) || '').trim();
    let nombre = tercero || (t.entidad || t.descripcion || 'Sin cliente').trim();
    nombre = canonCliente(nombre);
    const k = 'N:' + norm(nombre);
    if (!ing.has(k)) ing.set(k, { nombre, total: 0, dias: [] });
    const g = ing.get(k)!;
    g.total += t.importe || 0;
    let dia = g.dias.find((d) => d.fecha === f);
    if (!dia) { dia = { fecha: f, monto: 0, ccs: [] }; g.dias.push(dia); }
    dia.monto += t.importe || 0;
    const cc = ccMap.get(rowIndex);
    if (cc && !dia.ccs.includes(cc)) dia.ccs.push(cc);
  }
  const ingresos = [...ing.values()].sort((a, b) => b.total - a.total);
  ingresos.forEach((i) => i.dias.sort((a, b) => a.fecha.localeCompare(b.fecha)));

  // Gastos por categoría (excluye reembolsos y cuentas por cobrar a empleados)
  const gas = new Map<string, number>();
  for (const t of financeData.gastos) {
    const f = (t.fecha || '').slice(0, 10);
    if (!f.startsWith(periodo)) continue;
    const catNorm = norm(t.categoria);
    if (catNorm === 'REEMBOLSOS' || catNorm === 'CUENTAS POR COBRAR A EMPLEADOS (CUENTA)') continue;
    const cat = (t.categoria || 'Otros').trim();
    gas.set(cat, (gas.get(cat) || 0) + (t.importe || 0));
  }
  const gastos = [...gas.entries()].sort((a, b) => b[1] - a[1]);

  const totalIng = ingresos.reduce((a, i) => a + i.total, 0);
  const totalGas = gastos.reduce((a, [, v]) => a + v, 0);
  const utilidad = totalIng - totalGas;
  const utilColor = utilidad >= 0 ? '#16a34a' : '#dc2626';

  // ---- HTML (idéntico al reporte viejo) ----
  let tablaIng =
    `<tr><td style="padding:18px 24px 4px"><table width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="font-size:15px;font-weight:800;color:#18181b">Ingresos por cliente</td>` +
    `<td style="text-align:right;font-size:15px;font-weight:800;color:#16a34a">${money(totalIng)}</td></tr></table></td></tr>` +
    `<tr><td style="padding:0 24px 8px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
    `<tr style="background:#fafafa">` +
    `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Cliente / Fecha</th>` +
    `<th style="padding:6px 10px;text-align:right;font-size:10px;color:#a1a1aa;text-transform:uppercase">Valor</th>` +
    `<th style="padding:6px 10px;text-align:right;font-size:10px;color:#a1a1aa;text-transform:uppercase">%</th></tr>`;
  for (const i of ingresos) {
    const pct = totalIng ? (i.total / totalIng) * 100 : 0;
    tablaIng +=
      `<tr><td style="padding:9px 10px 3px;border-top:1px solid #ececec;font-size:13px;font-weight:700;color:#18181b">${i.nombre}</td>` +
      `<td style="padding:9px 10px 3px;border-top:1px solid #ececec;font-size:13px;text-align:right;font-weight:800;color:#16a34a">${money(i.total)}</td>` +
      `<td style="padding:9px 10px 3px;border-top:1px solid #ececec;font-size:12px;text-align:right;color:#71717a">${pct.toFixed(1)}%</td></tr>`;
    for (const d of i.dias) {
      const ccTxt = d.ccs.length ? ' &middot; Cta ' + d.ccs.map((c) => '#' + c).join(', ') : '';
      tablaIng +=
        `<tr><td style="padding:2px 10px 2px 26px;font-size:12px;color:#94a3b8">${fmtFecha(d.fecha)}${ccTxt}</td>` +
        `<td style="padding:2px 10px;font-size:12px;text-align:right;color:#64748b">${money(d.monto)}</td><td></td></tr>`;
    }
  }
  if (!ingresos.length) tablaIng += '<tr><td colspan="3" style="padding:10px;font-size:13px;color:#a1a1aa">Sin ingresos este mes.</td></tr>';
  tablaIng += '</table></td></tr>';

  let tablaGas =
    `<tr><td style="padding:18px 24px 4px"><table width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="font-size:15px;font-weight:800;color:#18181b">Gastos por categoria</td>` +
    `<td style="text-align:right;font-size:15px;font-weight:800;color:#b45309">${money(totalGas)}</td></tr></table></td></tr>` +
    `<tr><td style="padding:0 24px 8px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
    `<tr style="background:#fafafa">` +
    `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Categoria</th>` +
    `<th style="padding:6px 10px;text-align:right;font-size:10px;color:#a1a1aa;text-transform:uppercase">Valor</th>` +
    `<th style="padding:6px 10px;text-align:right;font-size:10px;color:#a1a1aa;text-transform:uppercase">%</th></tr>`;
  for (const [cat, val] of gastos) {
    const pct = totalGas ? (val / totalGas) * 100 : 0;
    tablaGas +=
      `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#18181b">${cat}</td>` +
      `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:700;color:#b45309">${money(val)}</td>` +
      `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:right;color:#71717a">${pct.toFixed(1)}%</td></tr>`;
  }
  if (!gastos.length) tablaGas += '<tr><td colspan="3" style="padding:10px;font-size:13px;color:#a1a1aa">Sin movimientos este mes.</td></tr>';
  tablaGas += '</table></td></tr>';

  const resumenHtml =
    `<tr><td style="padding:24px 24px 4px">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">` +
    `<tr><td style="padding:12px 18px;font-size:14px;color:#334155">Gastos del mes</td>` +
    `<td style="padding:12px 18px;text-align:right;font-size:14px;font-weight:700;color:#b45309">${money(totalGas)}</td></tr>` +
    `<tr><td style="padding:12px 18px;font-size:14px;color:#334155">Ingresos del mes</td>` +
    `<td style="padding:12px 18px;text-align:right;font-size:14px;font-weight:700;color:#16a34a">${money(totalIng)}</td></tr>` +
    `<tr><td style="padding:14px 18px;font-size:16px;font-weight:800;color:${utilColor};border-top:2px solid #cbd5e1">Utilidad del mes</td>` +
    `<td style="padding:14px 18px;text-align:right;font-size:20px;font-weight:800;color:${utilColor};border-top:2px solid #cbd5e1">${money(utilidad)}</td></tr>` +
    `</table></td></tr>`;

  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,sans-serif;background:#f4f4f5">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px"><tr><td align="center">` +
    `<table width="720" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.08)">` +
    `<tr><td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 30px">` +
    `<h1 style="margin:0;color:#fff;font-size:22px">Estado de Resultados</h1>` +
    `<p style="margin:6px 0 0;color:#e0e7ff;font-size:14px">DT Growth Partners &mdash; ${periodoLabel} &middot; Corte: ${corte}</p></td></tr>` +
    resumenHtml + tablaGas + tablaIng +
    `<tr><td style="padding:22px 30px;text-align:center;background:#f4f4f5">` +
    `<p style="margin:0 0 4px;font-size:12px;color:#71717a">Generado automaticamente desde DT-OS (datos en tiempo real de Contabilidad)</p>` +
    `<p style="margin:0;font-size:11px;color:#a1a1aa">DT Growth Partners</p></td></tr>` +
    `</table></td></tr></table></body></html>`;

  return {
    subject: `Estado de Resultados ${periodoLabel} - DT Growth Partners (Utilidad ${money(utilidad)})`,
    html,
    resumen: `ingresos ${money(totalIng)} | gastos ${money(totalGas)} | utilidad ${money(utilidad)}`,
  };
}

// ==================== Estado de Cartera ====================

// Alias: el mismo cliente llega con NITs inconsistentes → agrupar por nombre
const NAME_ALIASES: Record<string, string> = {
  'TENIS CARTAGENA': 'Tennis Cartagena',
  'TENNIS CARTAGENA': 'Tennis Cartagena',
};
const NIT_ALIAS: Record<string, string> = {
  '9018834468': '901883468', // Caribe Fest: NIT con dígito extra
};

interface InvRow {
  numero: string; cliente: string; nit: string | null; total: number;
  abonado: number; saldo: number; estado: string; fecha: string;
  concepto: string | null; servicio: string | null;
}

const groupKey = (i: InvRow) => {
  const nombreNorm = norm(i.cliente);
  if (NAME_ALIASES[nombreNorm]) return 'NOM:' + NAME_ALIASES[nombreNorm].toUpperCase();
  let nit = (i.nit || '').replace(/\D/g, '');
  nit = NIT_ALIAS[nit] || nit;
  if (nit.length >= 9 && !/^0+$/.test(nit)) return 'NIT:' + nit;
  return 'NOM:' + nombreNorm;
};

const diasMora = (fecha: string, hoy: Date): number | null => {
  const m = fecha?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/) || fecha?.slice(0, 10).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = fecha.includes('-') ? new Date(`${fecha.slice(0, 10)}T12:00:00`) : new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
};

const moraStyle = (dias: number | null): [string, string] => {
  if (dias === null) return ['#a1a1aa', '#f4f4f5'];
  if (dias > 60) return ['#b91c1c', '#fee2e2'];
  if (dias > 30) return ['#b45309', '#fef3c7'];
  return ['#3f6212', '#ecfccb'];
};

const LBL: Record<string, string> = { pendiente: 'Pendiente', enviada: 'Enviada', parcial: 'Parcial' };
const CLR: Record<string, string> = { pendiente: '#b45309', enviada: '#6d28d9', parcial: '#0369a1' };
const BGC: Record<string, string> = { pendiente: '#fef3c7', enviada: '#ede9fe', parcial: '#e0f2fe' };

export async function reporteCartera(): Promise<{ subject: string; html: string; resumen: string }> {
  const hoy = hoyBogota();
  const corte = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

  const raw = await prisma.invoice.findMany({
    where: { status: { not: 'pagada' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const invs: InvRow[] = raw.map((inv) => ({
    numero: inv.invoiceNumber,
    cliente: inv.clientName,
    nit: inv.clientNit,
    total: inv.totalAmount,
    abonado: inv.paidAmount || 0,
    saldo: inv.totalAmount - (inv.paidAmount || 0),
    estado: inv.status,
    fecha: inv.fecha.toISOString().split('T')[0],
    concepto: inv.concepto,
    servicio: inv.servicio,
  }));

  const groups = new Map<string, InvRow[]>();
  const disp = new Map<string, string>();
  for (const i of invs) {
    const k = groupKey(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
    const nombreNorm = norm(i.cliente);
    if (NAME_ALIASES[nombreNorm]) disp.set(k, NAME_ALIASES[nombreNorm]);
    else if (!disp.has(k)) disp.set(k, (i.cliente || '').trim());
  }
  const total = invs.reduce((a, i) => a + i.saldo, 0);
  const facturado = invs.reduce((a, i) => a + i.total, 0);

  let cuerpo = '';
  let cards = '';
  if (!invs.length) {
    cuerpo = `<tr><td style="padding:30px;text-align:center;font-size:16px;color:#16a34a">&#9989; No hay cartera pendiente en este corte.</td></tr>`;
  } else {
    const moraTotal = new Map<string, number>();
    for (const [k, facs] of groups) moraTotal.set(k, facs.reduce((a, x) => a + (diasMora(x.fecha, hoy) || 0), 0));
    const ordenados = [...groups.keys()].sort((a, b) => (moraTotal.get(b) || 0) - (moraTotal.get(a) || 0));
    for (const k of ordenados) {
      const facs = groups.get(k)!;
      const sub = facs.reduce((a, x) => a + x.saldo, 0);
      let filas = '';
      for (const f of [...facs].sort((a, b) => b.saldo - a.saldo)) {
        const c = (f.concepto || f.servicio || 'Sin concepto').trim();
        const extra = f.abonado > 0 ? ` &middot; abonado ${money(f.abonado)} de ${money(f.total)}` : '';
        const dm = diasMora(f.fecha, hoy);
        const [mcl, mbg] = moraStyle(dm);
        filas +=
          `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#52525b">${f.numero}</td>` +
          `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#52525b">${f.fecha}</td>` +
          `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#18181b">${c}${extra}</td>` +
          `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0"><span style="background:${BGC[f.estado] || '#f4f4f5'};color:${CLR[f.estado] || '#52525b'};font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">${LBL[f.estado] || f.estado}</span></td>` +
          `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0"><span style="background:${mbg};color:${mcl};font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">${dm !== null ? dm + ' dias' : '-'}</span></td>` +
          `<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:700;color:#b45309">${money(f.saldo)}</td></tr>`;
      }
      cuerpo +=
        `<tr><td style="padding:18px 24px 4px"><table width="100%" cellpadding="0" cellspacing="0"><tr>` +
        `<td style="font-size:15px;font-weight:800;color:#18181b">${disp.get(k)}</td>` +
        `<td style="text-align:right;font-size:15px;font-weight:800;color:#b45309">${money(sub)}</td></tr></table></td></tr>` +
        `<tr><td style="padding:0 24px 8px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">` +
        `<tr style="background:#fafafa">` +
        `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Factura</th>` +
        `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Fecha</th>` +
        `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Concepto</th>` +
        `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">Estado</th>` +
        `<th style="padding:6px 10px;text-align:left;font-size:10px;color:#a1a1aa;text-transform:uppercase">D&iacute;as mora</th>` +
        `<th style="padding:6px 10px;text-align:right;font-size:10px;color:#a1a1aa;text-transform:uppercase">Saldo</th></tr>${filas}</table></td></tr>`;
    }
    cards =
      `<tr><td style="padding:24px 24px 4px">` +
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">` +
      `<tr><td style="padding:14px 18px;font-size:14px;color:#334155">Valor facturado en el periodo</td>` +
      `<td style="padding:14px 18px;text-align:right;font-size:14px;color:#334155">${money(facturado)}</td></tr>` +
      `<tr><td style="padding:14px 18px;font-size:16px;font-weight:800;color:#b45309;border-top:2px solid #cbd5e1">Valor por cobrar</td>` +
      `<td style="padding:14px 18px;text-align:right;font-size:20px;font-weight:800;color:#b45309;border-top:2px solid #cbd5e1">${money(total)}</td></tr>` +
      `</table><p style="margin:8px 2px 0;font-size:11px;color:#94a3b8">${invs.length} facturas pendientes en ${groups.size} clientes.</p></td></tr>`;
  }

  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,sans-serif;background:#f4f4f5">` +
    `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px"><tr><td align="center">` +
    `<table width="720" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.08)">` +
    `<tr><td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:28px 30px">` +
    `<h1 style="margin:0;color:#fff;font-size:22px">Estado de Cartera</h1>` +
    `<p style="margin:6px 0 0;color:#e0f2fe;font-size:14px">DT Growth Partners &mdash; Corte: ${corte}</p></td></tr>` +
    cards + cuerpo +
    `<tr><td style="background:#f4f4f5;padding:22px 30px;text-align:center">` +
    `<p style="margin:0 0 4px;font-size:12px;color:#71717a">Reporte de cartera generado automaticamente desde DT-OS</p>` +
    `<p style="margin:0;font-size:11px;color:#a1a1aa">DT Growth Partners</p></td></tr>` +
    `</table></td></tr></table></body></html>`;

  const subject = invs.length
    ? `Estado de Cartera - DT Growth Partners (${corte}) - ${money(total)} por cobrar`
    : `Estado de Cartera - DT Growth Partners (${corte}) - Sin pendientes`;

  return { subject, html, resumen: `total ${money(total)} | ${invs.length} facturas | ${groups.size} clientes` };
}

// ==================== Orquestador ====================

export async function enviarReportesDiarios(opts: { dryRun?: boolean } = {}) {
  const resultados: Record<string, string> = {};
  for (const [nombre, gen] of [
    ['estado-resultados', reporteEstadoResultados],
    ['cartera', reporteCartera],
  ] as const) {
    try {
      const { subject, html, resumen } = await gen();
      if (!opts.dryRun) await enviar(subject, html);
      resultados[nombre] = `${opts.dryRun ? '[dry-run] ' : 'enviado: '}${resumen}`;
      console.log(`[reportes] ${nombre} → ${resultados[nombre]}`);
    } catch (e: any) {
      resultados[nombre] = `ERROR: ${e?.message}`;
      console.error(`[reportes] ${nombre} falló:`, e?.message);
    }
  }
  return resultados;
}
