import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { google } from 'googleapis';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

/**
 * Monitor de movimientos bancarios (Bancolombia) — port nativo del antiguo
 * api-cuentas-de-cobro/email_monitor.py + send_pending.js.
 *
 * Flujo: IMAP (contabilidad@) → parsear alerta de Bancolombia → clasificar
 * categoría (con las categorías válidas del Sheets) → insertar en fila 2 de
 * Entradas/Salidas → registrar en BankTransaction (auditoría) → notificar
 * Slack → encolar aviso al grupo de WhatsApp "MOVIMIENTOS DTGP".
 *
 * Se activa con BANK_MONITOR=on en el .env (no corre en dev por accidente).
 */

const prisma = new PrismaClient();

const SPREADSHEET_ID = '1SKHZBmxEsZgKjoEx_p5QtyOy21Z0o9twIsWWlICmuzE';
const CREDENTIALS_PATH = path.join(__dirname, '../../..', 'credencials.json');

const IMAP_HOST = process.env.BANK_IMAP_HOST || 'localhost';
const IMAP_PORT = Number(process.env.BANK_IMAP_PORT || 993);
const IMAP_USER = process.env.BANK_IMAP_USER || 'contabilidad@dtgrowthpartners.com';
const IMAP_PASS = process.env.BANK_IMAP_PASS || '';
const SLACK_WEBHOOK = process.env.BANK_SLACK_WEBHOOK || '';
const BOT_URL = process.env.BOT_EXTERNO_URL || 'https://david.dtgrowthpartners.com/api/externo/enviar';
const BOT_KEY = process.env.BOT_EXTERNO_KEY || '';
const WA_GROUP = process.env.BANK_WA_GROUP || '120363427797637886@g.us'; // MOVIMIENTOS DTGP

const CHECK_INTERVAL_MS = 120_000; // igual que el monitor viejo (2 min)
const SEND_INTERVAL_MS = 60_000;

const log = (msg: string) => console.log(`[bank-monitor] ${new Date().toISOString()} ${msg}`);

// ==================== Google Sheets ====================

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Caché de categorías válidas (5 min), leídas de la validación de datos de la columna D
const catCache: Record<string, { cats: string[]; at: number }> = {};

async function categoriasValidas(tipo: 'entradas' | 'salidas'): Promise<string[]> {
  const hit = catCache[tipo];
  if (hit && Date.now() - hit.at < 300_000 && hit.cats.length) return hit.cats;
  const sheetName = tipo === 'entradas' ? 'Entradas' : 'Salidas';
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [`${sheetName}!D:D`],
      includeGridData: true,
    });
    const categorias: string[] = [];
    for (const sheet of meta.data.sheets || []) {
      if (sheet.properties?.title !== sheetName) continue;
      for (const data of sheet.data || []) {
        for (const row of data.rowData || []) {
          for (const cell of row.values || []) {
            const cond = cell.dataValidation?.condition;
            if (cond?.type === 'ONE_OF_LIST') {
              for (const v of cond.values || []) {
                const val = v.userEnteredValue;
                if (val && !categorias.includes(val)) categorias.push(val);
              }
              if (categorias.length) {
                catCache[tipo] = { cats: categorias, at: Date.now() };
                return categorias;
              }
            }
          }
        }
      }
    }
    // Sin validación de datos: valores únicos de la columna
    if (!categorias.length) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!D:D` });
      for (const row of (r.data.values || []).slice(1)) {
        if (row?.[0] && !categorias.includes(row[0])) categorias.push(row[0]);
      }
    }
    catCache[tipo] = { cats: categorias, at: Date.now() };
    return categorias;
  } catch (e: any) {
    log(`error obteniendo categorías: ${e?.message}`);
    return hit?.cats || [];
  }
}

/** Inserta una fila en la posición 2 (bajo el encabezado) empujando el resto hacia abajo */
async function insertarEnFila2(sheetName: string, valores: (string | number)[]): Promise<boolean> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const target = (meta.data.sheets || []).find((s) => s.properties?.title === sheetName);
    if (!target) { log(`no existe la hoja ${sheetName}`); return false; }
    const sheetId = target.properties!.sheetId!;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          insertDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
            inheritFromBefore: false,
          },
        }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:G2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [valores] },
    });
    return true;
  } catch (e: any) {
    log(`error insertando en fila 2: ${e?.message}`);
    return false;
  }
}

// ==================== Parsing de alertas Bancolombia ====================

/** Bancolombia mezcla formatos: "28.250,00" (europeo), "200,000" (americano), "1.800.000".
 *  Desambigua por la cantidad de dígitos tras el último separador: 3 = miles, 1-2 = decimal. */
export function parseMonto(raw: string): number {
  let s = raw.trim().replace(/^\$/, '').trim().replace(/[.,]+$/, '');
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2 || parts[1].length === 3) s = s.replace(/\./g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length > 2 || parts[1].length === 3) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  return parseFloat(s);
}

export interface TxData {
  tipo: 'entrante' | 'saliente';
  monto: number;
  descripcion: string;
  fecha: string;
  cuenta: string;
  categoria: string;
  entidad: string;
}

// Remitentes internos: una transferencia recibida de ellos es traslado, no pago de cliente
const PROPIOS = ['DAIRO', 'TRASLAVI', 'DT GROWTH', 'ANTEQUERA'];

export async function extraerTransaccion(emailBody: string): Promise<TxData | null> {
  try {
    const text = emailBody.replace(/\n/g, ' ').replace(/\r/g, '');

    let tipo: 'entrante' | 'saliente';
    let tipoDesc: string;
    if (/Compraste|Pagaste|Compra/i.test(text)) { tipo = 'saliente'; tipoDesc = 'Compra'; }
    else if (/Transferiste|Transferencia enviada/i.test(text)) { tipo = 'saliente'; tipoDesc = 'Transferencia'; }
    else if (/Recibiste|Transferencia recibida/i.test(text)) { tipo = 'entrante'; tipoDesc = 'Transferencia recibida'; }
    else { tipo = 'saliente'; tipoDesc = 'Transacción'; }

    const montoMatch = text.match(/\$\s?([\d.,]+)/);
    if (!montoMatch) return null;
    const monto = parseMonto(montoMatch[1]);
    if (!Number.isFinite(monto)) return null;

    let descripcion = '';
    let remitente: string | null = null;
    if (tipo === 'entrante') {
      // "... por $X de FULANO en tu cuenta ..." → el remitente es el pagador
      const rem = text.match(/\bde\s+(.{2,60}?)\s+en\s+tu\s+cuenta/i);
      if (rem) {
        remitente = rem[1].replace(/\s+/g, ' ').trim();
        descripcion = `Transferencia recibida de ${remitente}`;
      }
    }
    if (!descripcion) {
      const comercio = text.match(/(?:en|a)\s+([A-Z0-9\s\-._*]+?)(?:\s+con|\s+el|\s*,)/i);
      if (comercio) descripcion = `${tipoDesc} en ${comercio[1].trim().replace(/\*+$/, '')}`;
      else descripcion = tipoDesc;
    }

    const fechaMatch = text.match(/el\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+las\s+(\d{2}:\d{2})/);
    const fecha = fechaMatch
      ? `${fechaMatch[1]} ${fechaMatch[2]}:00`
      : formatearAhora();

    const esPagoCliente = tipo === 'entrante' && !!remitente &&
      !PROPIOS.some((p) => remitente!.toUpperCase().includes(p));

    return {
      tipo,
      monto,
      descripcion,
      fecha,
      cuenta: 'Bancolombia',
      categoria: esPagoCliente ? 'PAGO DE CLIENTE' : await clasificarCategoria(descripcion, tipo),
      entidad: esPagoCliente ? titleCase(remitente!) : 'DT Growth Partners',
    };
  } catch (e: any) {
    log(`error extrayendo datos: ${e?.message}`);
    return null;
  }
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const formatearAhora = () => {
  // fecha local Bogotá en DD/MM/YYYY HH:mm:ss, como la registraba el monitor viejo
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

// Mapeo keyword → categorías candidatas (mismo del monitor viejo)
const MAPEO_KEYWORDS: Record<string, string[]> = {
  rappi: ['almuerzos', 'meriendas'],
  'uber eats': ['almuerzos', 'meriendas'],
  domicilio: ['almuerzos', 'meriendas'],
  restaurante: ['almuerzos'],
  comida: ['almuerzos'],
  almuerzo: ['almuerzos'],
  merienda: ['meriendas'],
  uber: ['transportes - gasolina', 'transportes'],
  taxi: ['transportes - gasolina', 'transportes'],
  transporte: ['transportes - gasolina', 'transportes'],
  gasolina: ['transportes - gasolina'],
  publicidad: ['publicidad'],
  meta: ['publicidad'],
  facebook: ['publicidad'],
  'google ads': ['publicidad'],
  marketing: ['publicidad'],
  nequi: ['traslado de nequi'],
  daviplata: ['traslado de daviplata'],
  bancolombia: ['traslado de bancolombia'],
  rappicuenta: ['traslado de rappicuenta'],
  transferencia: ['traslado de bancolombia', 'traslado de nequi'],
  servidor: ['servidores/hosting/dominios'],
  hosting: ['servidores/hosting/dominios'],
  dominio: ['servidores/hosting/dominios'],
  namecheap: ['servidores/hosting/dominios'],
  'name-cheap': ['servidores/hosting/dominios'],
  godaddy: ['servidores/hosting/dominios'],
  cloudflare: ['servidores/hosting/dominios'],
  digitalocean: ['servidores/hosting/dominios'],
  aws: ['servidores/hosting/dominios'],
  'amazon web': ['servidores/hosting/dominios'],
  azure: ['servidores/hosting/dominios'],
  siteground: ['servidores/hosting/dominios'],
  hostinger: ['servidores/hosting/dominios'],
  vercel: ['servidores/hosting/dominios'],
  netlify: ['servidores/hosting/dominios'],
  render: ['servidores/hosting/dominios'],
  claude: ['herramientas (claude, gpt, lovable, twilio, etc)'],
  gpt: ['herramientas (claude, gpt, lovable, twilio, etc)'],
  openai: ['herramientas (claude, gpt, lovable, twilio, etc)'],
  lovable: ['herramientas (claude, gpt, lovable, twilio, etc)'],
  twilio: ['herramientas (claude, gpt, lovable, twilio, etc)'],
  freelancer: ['freelancers'],
  contador: ['honorarios contador'],
  arriendo: ['arriendo'],
  nomina: ['nómina (stiven)', 'nómina (dairo)', 'nómina (edgardo)'],
  'pago cliente': ['pago de cliente'],
  cliente: ['pago de cliente'],
};

export async function clasificarCategoria(descripcion: string, tipo: 'entrante' | 'saliente'): Promise<string> {
  const desc = descripcion.toLowerCase();
  const validas = await categoriasValidas(tipo === 'entrante' ? 'entradas' : 'salidas');
  const porLower = new Map(validas.map((c) => [c.toLowerCase(), c]));

  for (const [keyword, candidatas] of Object.entries(MAPEO_KEYWORDS)) {
    if (desc.includes(keyword)) {
      for (const cand of candidatas) {
        const hit = porLower.get(cand);
        if (hit) return hit;
      }
    }
  }
  for (const [catLower, catOriginal] of porLower) {
    for (const palabra of desc.split(/\s+/)) {
      if (palabra.length > 3 && catLower.includes(palabra)) return catOriginal;
    }
  }
  if (desc.includes('nequi') && porLower.has('traslado de nequi')) return porLower.get('traslado de nequi')!;
  if (desc.includes('daviplata') && porLower.has('traslado de daviplata')) return porLower.get('traslado de daviplata')!;
  if (desc.includes('bancolombia') && porLower.has('traslado de bancolombia')) return porLower.get('traslado de bancolombia')!;
  if (validas.length) {
    const generica = validas.find((c) => /ajuste|otro/i.test(c));
    return generica || validas[0];
  }
  return 'Sin categoría';
}

// ==================== Notificaciones ====================

async function notificarSlack(d: TxData) {
  if (!SLACK_WEBHOOK) return;
  try {
    const emoji = d.tipo === 'saliente' ? '💸' : '💰';
    const titulo = d.tipo === 'saliente' ? 'Nueva salida detectada' : 'Nueva entrada detectada';
    const monto = '$' + Math.round(d.monto).toLocaleString('de-DE');
    const texto = `${emoji} *${titulo}*\n\n*Importe:* ${monto} COP\n*Descripción:* ${d.descripcion}\n*Categoría:* ${d.categoria}\n*Cuenta:* ${d.cuenta}\n*Fecha:* ${d.fecha}\n*Entidad:* ${d.entidad}`;
    await axios.post(SLACK_WEBHOOK, { text: texto }, { timeout: 15_000 });
  } catch (e: any) {
    log(`error notificando Slack: ${e?.message}`);
  }
}

/** Envía al grupo de WhatsApp las transacciones registradas y aún no notificadas */
async function enviarPendientesWhatsApp() {
  if (!BOT_KEY) return;
  const pendientes = await prisma.bankTransaction.findMany({
    where: { sheetOk: true, notificado: false },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  for (const tx of pendientes) {
    const emoji = tx.tipo === 'saliente' ? '💸' : '💰';
    const titulo = tx.tipo === 'saliente' ? '*Nueva Salida Bancolombia*' : '*Nueva Entrada Bancolombia*';
    const monto = '$' + Math.round(tx.monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' COP';
    const msg = [
      `${emoji} ${titulo}`, '',
      `*Importe:* ${monto}`,
      `*Descripción:* ${tx.descripcion}`,
      `*Categoría:* ${tx.categoria}`,
      `*Cuenta:* ${tx.cuenta}`,
      `*Fecha:* ${tx.fecha}`,
      '✅ Registrado en Google Sheets',
    ].join('\n');
    try {
      await axios.post(BOT_URL, { destino: WA_GROUP, mensaje: msg, origen: 'dtos_bank_monitor' }, {
        headers: { 'X-API-Key': BOT_KEY, 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 20_000,
      });
      await prisma.bankTransaction.update({ where: { id: tx.id }, data: { notificado: true } });
      log(`WhatsApp OK: ${tx.descripcion}`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e: any) {
      log(`fallo WhatsApp (${tx.descripcion}): ${e?.message} — reintenta en el próximo ciclo`);
      break; // si el bot está caído, no martillar con las demás
    }
  }
}

// ==================== Ciclo IMAP ====================

let procesando = false;

export async function procesarCorreos(dryRun = false, incluirLeidos = false): Promise<TxData[]> {
  const resultados: TxData[] = [];
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
    tls: { rejectUnauthorized: false }, // dovecot local con cert self-signed
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const criterio: any = { subject: 'Alertas y Notificaciones' };
      if (!incluirLeidos) criterio.seen = false;
      const uids = await client.search(criterio, { uid: true });
      if (!uids || !uids.length) return resultados;
      log(`procesando ${uids.length} correo(s)${dryRun ? ' [dry-run]' : ''}`);

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const body = parsed.text || parsed.html || '';
          const data = await extraerTransaccion(String(body));

          if (dryRun) {
            if (data) resultados.push(data);
            continue;
          }

          if (data) {
            const valores = [
              data.fecha,
              Math.trunc(data.monto),
              data.descripcion,
              data.categoria,
              data.cuenta,
              data.entidad,
              'tercero', // columna G del formato viejo
            ];
            const hoja = data.tipo === 'entrante' ? 'Entradas' : 'Salidas';
            const ok = await insertarEnFila2(hoja, valores);
            if (ok) {
              await prisma.bankTransaction.create({
                data: {
                  emailUid: uid,
                  tipo: data.tipo,
                  monto: data.monto,
                  descripcion: data.descripcion,
                  categoria: data.categoria,
                  cuenta: data.cuenta,
                  entidad: data.entidad,
                  fecha: data.fecha,
                  sheetOk: true,
                },
              });
              await notificarSlack(data);
              await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
              log(`✅ registrado: ${data.descripcion} $${data.monto}`);
              resultados.push(data);
            } else {
              log(`❌ falló Sheets para uid ${uid}; queda NO leído para reintentar`);
            }
          } else {
            // no parseable: marcar leído para no reintentar eternamente (igual que el viejo)
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            log(`⚠ correo uid ${uid} sin datos extraíbles; marcado leído`);
          }
        } catch (e: any) {
          log(`error con correo uid ${uid}: ${e?.message}`);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return resultados;
}

// ==================== Arranque ====================

export function startBankMonitor() {
  if (process.env.BANK_MONITOR !== 'on') {
    log('desactivado (BANK_MONITOR != on)');
    return;
  }
  if (!IMAP_PASS) {
    log('sin BANK_IMAP_PASS — no arranca');
    return;
  }
  log(`iniciando: IMAP ${IMAP_USER}@${IMAP_HOST}:${IMAP_PORT}, ciclo ${CHECK_INTERVAL_MS / 1000}s`);
  const ciclo = async () => {
    if (procesando) return;
    procesando = true;
    try { await procesarCorreos(); } catch (e: any) { log(`error ciclo: ${e?.message}`); }
    finally { procesando = false; }
  };
  ciclo();
  setInterval(ciclo, CHECK_INTERVAL_MS);
  setInterval(() => { enviarPendientesWhatsApp().catch((e) => log(`error sender: ${e?.message}`)); }, SEND_INTERVAL_MS);
}
