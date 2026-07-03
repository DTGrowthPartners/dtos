import { PrismaClient } from '@prisma/client';
import { googleSheetsService } from './googleSheets.service';
import { agentSendMessage } from './agents.service';
import { resolveDestino } from '../config/notifyPhones';

/**
 * Conciliación automática pagos (hoja Entradas) ↔ facturas (cuentas de cobro).
 *
 * Cada corrida (cron diario, idempotente vía PagoConciliado.sheetKey):
 *  - Pago con "No. Cuenta de Cobro" (col I) que coincide con una factura abierta
 *    y cabe en el saldo → se APLICA automáticamente (abono + estado parcial/pagada).
 *  - Pago sin número: si hay exactamente UNA factura abierta del mismo cliente con
 *    saldo compatible → queda como SUGERENCIA (Jhonatan decide, no se toca nada).
 *  - Resumen por WhatsApp a Jhonathan (y Dairo) solo si hubo novedades.
 */

const prisma = new PrismaClient();
const TOL = 1000; // tolerancia en pesos para comparar montos

const normName = (s: string) =>
  (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(SAS|LTDA|S\.A\.S|SA)\b/g, '').replace(/[^A-Z0-9]/g, '');

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

export interface ConciliacionResult {
  procesados: number;
  aplicados: string[];
  sugeridos: string[];
  sinMatch: number;
  errores: string[];
}

/**
 * Aplica un abono a una factura. Incrementa paidAmount (NO recalcula desde las
 * filas de InvoicePayment: hay facturas históricas con paidAmount sin filas, y
 * recalcular las pisaría).
 */
const aplicarAbono = async (invoiceId: string, amount: number, referencia: string) => {
  await prisma.invoicePayment.create({
    data: { invoiceId, amount, paymentMethod: 'Conciliación automática', reference: referencia },
  });
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return;
  const paid = (inv.paidAmount || 0) + amount;
  const data: any = { paidAmount: paid };
  if (paid >= inv.totalAmount - 0.01) { data.status = 'pagada'; data.paidAt = new Date(); }
  else if (paid > 0) { data.status = 'parcial'; }
  await prisma.invoice.update({ where: { id: invoiceId }, data });
};

export const runConciliacion = async (): Promise<ConciliacionResult> => {
  const result: ConciliacionResult = { procesados: 0, aplicados: [], sugeridos: [], sinMatch: 0, errores: [] };

  let pagos: Array<{ tercero: string; importe: number; fecha: string; descripcion: string; cuenta: string; cuentaCobro: string; tipoPago: string }> = [];
  try {
    pagos = await googleSheetsService.getClientPayments();
  } catch (e) {
    result.errores.push('No se pudo leer Sheets: ' + (e as Error).message);
    return result;
  }

  const openInvoices = await prisma.invoice.findMany({
    where: { status: { in: ['pendiente', 'parcial', 'enviada'] } },
  });

  for (const p of pagos) {
    if (!p.importe || p.importe <= 0) continue;
    const numCC = (p.cuentaCobro || '').replace(/[^0-9]/g, '');
    const key = `${p.fecha}|${Math.round(p.importe)}|${normName(p.tercero)}|${numCC}`;
    const visto = await prisma.pagoConciliado.findUnique({ where: { sheetKey: key } });
    if (visto) continue;
    result.procesados++;

    // ── 1) Match directo por número de cuenta de cobro ──
    if (numCC.length >= 10) {
      const inv = await prisma.invoice.findUnique({ where: { invoiceNumber: numCC } });
      if (inv) {
        const saldo = inv.totalAmount - (inv.paidAmount || 0);
        if (inv.status === 'pagada' || saldo <= 0) {
          await prisma.pagoConciliado.create({ data: { sheetKey: key, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, tercero: p.tercero, importe: p.importe, fecha: p.fecha, estado: 'ya-pagada' } });
          continue;
        }
        if (p.importe <= saldo + TOL) {
          try {
            const monto = Math.min(p.importe, saldo); // no exceder el saldo por redondeos
            await aplicarAbono(inv.id, monto, `Sheets ${p.fecha} · ${p.tercero}`);
            await prisma.pagoConciliado.create({ data: { sheetKey: key, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, tercero: p.tercero, importe: p.importe, fecha: p.fecha, estado: 'aplicado' } });
            result.aplicados.push(`${p.tercero} ${fmt(p.importe)} → #${inv.invoiceNumber}${monto >= saldo - 0.01 ? ' (PAGADA ✓)' : ' (abono)'}`);
            continue;
          } catch (e) {
            result.errores.push(`${p.tercero} #${numCC}: ${(e as Error).message}`);
            continue;
          }
        }
        // referencia una cuenta pero el monto excede el saldo: dejar como sugerencia
        await prisma.pagoConciliado.create({ data: { sheetKey: key, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, tercero: p.tercero, importe: p.importe, fecha: p.fecha, estado: 'sugerido' } });
        result.sugeridos.push(`${p.tercero} ${fmt(p.importe)} ≈ #${inv.invoiceNumber} (saldo ${fmt(saldo)}, revisar)`);
        continue;
      }
    }

    // ── 2) Sugerencia por cliente + monto compatible (exactamente 1 candidata) ──
    const tn = normName(p.tercero);
    if (tn.length >= 4) {
      const candidatas = openInvoices.filter((i) => {
        const inm = normName(i.clientName || '');
        if (inm.length < 4 || !(inm.includes(tn) || tn.includes(inm))) return false;
        const saldo = i.totalAmount - (i.paidAmount || 0);
        return saldo > 0 && Math.abs(saldo - p.importe) <= Math.max(TOL, saldo * 0.01);
      });
      if (candidatas.length === 1) {
        const inv = candidatas[0];
        await prisma.pagoConciliado.create({ data: { sheetKey: key, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, tercero: p.tercero, importe: p.importe, fecha: p.fecha, estado: 'sugerido' } });
        result.sugeridos.push(`${p.tercero} ${fmt(p.importe)} (${p.fecha.slice(0, 10)}) ≈ #${inv.invoiceNumber}`);
        continue;
      }
    }

    // ── 3) Sin match: registrar solo pagos viejos para no re-evaluarlos eternamente ──
    const pagoMs = Date.parse(p.fecha);
    const esViejo = !isNaN(pagoMs) && Date.now() - pagoMs > 30 * 86400000;
    if (esViejo) {
      await prisma.pagoConciliado.create({ data: { sheetKey: key, tercero: p.tercero, importe: p.importe, fecha: p.fecha, estado: 'sin-match' } });
    }
    result.sinMatch++;
  }

  // ── Resumen por WhatsApp (solo si hubo novedades) ──
  if (result.aplicados.length || result.sugeridos.length) {
    const lista = (arr: string[]) =>
      arr.slice(0, 12).map((l) => `• ${l}`).join('\n') + (arr.length > 12 ? `\n… y ${arr.length - 12} más` : '');
    const msj =
      `🧾 *Conciliación de pagos DTOS*\n` +
      (result.aplicados.length ? `\n✅ *Aplicados automáticamente* (por N° de cuenta):\n${lista(result.aplicados)}\n` : '') +
      (result.sugeridos.length ? `\n🔎 *Sugerencias para revisar* (cliente y monto coinciden):\n${lista(result.sugeridos)}\n` : '') +
      `\nPuedes registrar los abonos en DTOS → Finanzas → Cuentas de Cobro.`;
    for (const nombre of ['Jhonathan', 'Dairo']) {
      const destino = resolveDestino(nombre);
      if (destino) {
        try { await agentSendMessage('dairo', { destino, mensaje: msj, origen: 'dtos-conciliacion' }); }
        catch (e) { result.errores.push(`WhatsApp ${nombre}: ${(e as Error).message}`); }
      }
    }
  }

  console.log(`[conciliacion] procesados=${result.procesados} aplicados=${result.aplicados.length} sugeridos=${result.sugeridos.length} sinMatch=${result.sinMatch}`);
  return result;
};
