import { PrismaClient } from '@prisma/client';
import { agentSendMessage } from './agents.service';
import { resolveDestino } from '../config/notifyPhones';
import { getPublicInvoiceUrl } from './invoice.service';

/**
 * Cobranza automática por WhatsApp.
 *
 * Cada corrida (cron diario):
 *  - Agrupa las facturas abiertas (pendiente/parcial/enviada) por cliente.
 *  - A partir de 3 días de vencida, prepara un recordatorio cordial con los PDFs.
 *  - Si COBRANZA_ENVIO_CLIENTES=true y el cliente tiene teléfono, se lo envía
 *    (máximo 1 recordatorio por cliente cada 7 días).
 *  - Siempre envía un resumen a Dairo (modo revisión: solo el resumen, nada al cliente).
 */

const prisma = new PrismaClient();
const DAY = 86400000;
const CADENCIA_DIAS = 7;   // no repetir recordatorio al mismo cliente antes de esto
const MIN_DIAS_VENCIDA = 3; // días de gracia antes del primer recordatorio

const normName = (s: string) =>
  (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(SAS|LTDA|S\.A\.S|SA)\b/g, '').replace(/[^A-Z0-9]/g, '');

/** Normaliza un teléfono colombiano al formato +57XXXXXXXXXX (o jid si ya lo es). */
const normPhone = (raw?: string | null): string | null => {
  if (!raw) return null;
  if (raw.includes('@')) return raw; // ya es jid de WhatsApp
  const d = raw.replace(/[^0-9]/g, '');
  if (d.length === 10 && d.startsWith('3')) return `+57${d}`;
  if (d.length === 12 && d.startsWith('57')) return `+${d}`;
  if (d.length >= 11) return `+${d}`;
  return null;
};

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

interface GrupoCliente {
  clientId: string | null;
  nombre: string;
  telefono: string | null;
  saldo: number;
  diasMax: number;
  facturas: { id: string; numero: string; saldo: number; dias: number }[];
  yaRecordadoRecientemente: boolean;
}

export interface CobranzaResult {
  modo: 'directo' | 'revision';
  carteraTotal: number;
  clientesConDeuda: number;
  enviados: string[];
  sinTelefono: string[];
  enCadencia: string[];
  errores: string[];
}

export const runCobranza = async (): Promise<CobranzaResult> => {
  const directo = process.env.COBRANZA_ENVIO_CLIENTES === 'true';
  const now = Date.now();

  const open = await prisma.invoice.findMany({
    where: { status: { in: ['pendiente', 'parcial', 'enviada'] } },
    orderBy: { fecha: 'asc' },
  });
  const clients = await prisma.client.findMany({ include: { terceros: true } });

  // Agrupar facturas abiertas por cliente (clientId directo o nombre normalizado)
  const grupos = new Map<string, GrupoCliente>();
  for (const inv of open) {
    const saldo = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
    if (saldo <= 0) continue;
    const dias = Math.floor((now - inv.fecha.getTime()) / DAY);

    const cl = clients.find((c) => c.id === inv.clientId) ||
      clients.find((c) => {
        const a = normName(c.name), b = normName(inv.clientName || '');
        return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
      });

    const key = cl?.id || normName(inv.clientName || inv.id);
    const g = grupos.get(key) || {
      clientId: cl?.id || null,
      nombre: cl?.name || inv.clientName || 'Cliente',
      telefono: normPhone(cl?.phone) || normPhone(cl?.terceros?.find((t) => t.telefono)?.telefono) || null,
      saldo: 0, diasMax: 0, facturas: [],
      yaRecordadoRecientemente: false,
    };
    g.saldo += saldo;
    g.diasMax = Math.max(g.diasMax, dias);
    g.facturas.push({ id: inv.id, numero: inv.invoiceNumber, saldo, dias });
    if (inv.lastReminderAt && now - inv.lastReminderAt.getTime() < CADENCIA_DIAS * DAY) {
      g.yaRecordadoRecientemente = true;
    }
    grupos.set(key, g);
  }

  const result: CobranzaResult = {
    modo: directo ? 'directo' : 'revision',
    carteraTotal: 0,
    clientesConDeuda: 0,
    enviados: [], sinTelefono: [], enCadencia: [], errores: [],
  };

  const lineasResumen: string[] = [];

  for (const g of [...grupos.values()].sort((a, b) => b.saldo - a.saldo)) {
    result.carteraTotal += g.saldo;
    result.clientesConDeuda++;
    if (g.diasMax < MIN_DIAS_VENCIDA) continue; // aún en periodo de gracia

    const icono = g.diasMax >= 30 ? '🔴' : g.diasMax >= 15 ? '🟠' : '🟡';
    let estado: string;

    if (g.yaRecordadoRecientemente) {
      estado = 'recordado hace <7d';
      result.enCadencia.push(g.nombre);
    } else if (!g.telefono) {
      estado = 'SIN TELÉFONO';
      result.sinTelefono.push(g.nombre);
    } else if (!directo) {
      estado = `listo para enviar a ${g.telefono}`;
    } else {
      // Enviar recordatorio real al cliente
      const detalle = g.facturas
        .map((f) => `• Cuenta #${f.numero} — *${fmt(f.saldo)}*\n  📄 ${getPublicInvoiceUrl(f.id)}`)
        .join('\n');
      const msj =
        `Hola 👋 Le escribimos de *DT Growth Partners*.\n\n` +
        `Tiene ${g.facturas.length === 1 ? 'una cuenta de cobro pendiente' : `${g.facturas.length} cuentas de cobro pendientes`} por un total de *${fmt(g.saldo)}*:\n\n` +
        `${detalle}\n\n` +
        `Agradecemos su pago a la mayor brevedad. Cualquier inquietud, con gusto la atendemos. 🙌`;
      try {
        await agentSendMessage('dairo', { destino: g.telefono, mensaje: msj, origen: 'dtos-cobranza' });
        await prisma.invoice.updateMany({
          where: { id: { in: g.facturas.map((f) => f.id) } },
          data: { lastReminderAt: new Date(), remindersSent: { increment: 1 } },
        });
        estado = `enviado ✓ (${g.telefono})`;
        result.enviados.push(g.nombre);
      } catch (e) {
        estado = `error: ${(e as Error).message}`;
        result.errores.push(`${g.nombre}: ${(e as Error).message}`);
      }
    }

    lineasResumen.push(`${icono} *${g.nombre}* — ${fmt(g.saldo)} (${g.facturas.length} fact, ${g.diasMax}d) — ${estado}`);
  }

  // Resumen diario a Dairo (siempre)
  const destinoDairo = resolveDestino('Dairo');
  if (destinoDairo && lineasResumen.length) {
    const encabezado = directo
      ? `📋 *Cobranza automática* — recordatorios de hoy`
      : `📋 *Cobranza (modo revisión)* — nada se envió a clientes aún`;
    const pie = directo
      ? `\nEnviados: ${result.enviados.length} · Sin teléfono: ${result.sinTelefono.length}`
      : `\n💡 Para activar el envío automático a clientes: COBRANZA_ENVIO_CLIENTES=true en el backend.`;
    const msjDairo =
      `${encabezado}\n` +
      `Cartera abierta: *${fmt(result.carteraTotal)}* en ${result.clientesConDeuda} clientes\n\n` +
      lineasResumen.join('\n') + '\n' + pie;
    try {
      await agentSendMessage('dairo', { destino: destinoDairo, mensaje: msjDairo, origen: 'dtos-cobranza' });
    } catch (e) {
      result.errores.push(`resumen a Dairo: ${(e as Error).message}`);
    }
  }

  console.log(`[cobranza] modo=${result.modo} cartera=${result.carteraTotal} enviados=${result.enviados.length} sinTel=${result.sinTelefono.length}`);
  return result;
};
