import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { sendChatPush } from './push.service';
import { getUsageSnapshot } from '../routes/aiUsage.routes';

/**
 * Resumen diario de María en el Chat General.
 *
 * Cada mañana publica (como María) un mensaje con: cartera abierta, cobros que
 * tocan hoy, tareas vencidas por persona y uso de Claude. Notifica por push a
 * quien no esté en la app. Cron: /api/webhook/bot/digest/run.
 */

const prisma = new PrismaClient();
const DAY = 86400000;
const GENERAL_ROOM = 'general';

const fmtM = (n: number) => {
  const m = n / 1e6;
  return '$' + (m >= 1 ? (Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)) + 'M' : Math.round(n / 1000) + 'k');
};

const hoyBogota = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha de tarea en Firestore: puede ser string ISO/`YYYY-MM-DD` o Timestamp. */
const taskDueMs = (v: any): number | null => {
  if (!v) return null;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'number') return v;
  return null;
};

export const runDailyDigest = async () => {
  const hoy = hoyBogota();
  const fechaLabel = `${DIAS[hoy.getDay()]} ${hoy.getDate()} ${MESES[hoy.getMonth()]}`;
  const lineas: string[] = [`🌅 *Buenos días — resumen DTOS (${fechaLabel})*`, ''];

  // ── Cartera abierta (facturas pendientes/parciales) ──
  const open = await prisma.invoice.findMany({ where: { status: { in: ['pendiente', 'parcial', 'enviada'] } } });
  const porCliente = new Map<string, { saldo: number; dias: number }>();
  let cartera = 0;
  for (const i of open) {
    const saldo = Math.max(0, i.totalAmount - (i.paidAmount || 0));
    if (saldo <= 0) continue;
    cartera += saldo;
    const g = porCliente.get(i.clientName) || { saldo: 0, dias: 0 };
    g.saldo += saldo;
    g.dias = Math.max(g.dias, Math.floor((Date.now() - i.fecha.getTime()) / DAY));
    porCliente.set(i.clientName, g);
  }
  const top = [...porCliente.entries()].sort((a, b) => b[1].saldo - a[1].saldo).slice(0, 3);
  lineas.push(`💰 *Cartera:* ${fmtM(cartera)} en ${porCliente.size} clientes`);
  if (top.length) lineas.push('   ' + top.map(([n, g]) => `${g.dias >= 30 ? '🔴' : g.dias >= 15 ? '🟠' : '🟡'} ${n} ${fmtM(g.saldo)} (${g.dias}d)`).join(' · '));

  // ── Cobros recurrentes que tocan hoy ──
  const iniDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finDia = new Date(iniDia.getTime() + DAY - 1);
  const cobrosHoy = await prisma.clientService.findMany({
    where: { estado: 'activo', esComision: false, frecuencia: { not: 'unico' }, fechaProximoCobro: { gte: iniDia, lte: finDia } },
    include: { client: { select: { name: true } }, service: { select: { name: true, price: true } } },
  });
  if (cobrosHoy.length) {
    lineas.push(`📅 *Cobros de hoy:* ` + cobrosHoy.map((c) => `${c.client.name} (${fmtM(c.precioCliente ?? c.service.price ?? 0)})`).join(' · '));
  }

  // ── Tareas vencidas por persona (Firestore) ──
  try {
    const snap = await admin.firestore().collection('tasks').get();
    const vencidasPor = new Map<string, number>();
    const nowMs = Date.now();
    for (const d of snap.docs) {
      const t: any = d.data();
      const status = String(t.status || '').toLowerCase();
      if (status === 'done' || status === 'completed') continue;
      const due = taskDueMs(t.dueDate);
      if (due && due < nowMs - DAY / 2) {
        const who = t.assignee || t.asignado || 'Sin asignar';
        vencidasPor.set(who, (vencidasPor.get(who) || 0) + 1);
      }
    }
    if (vencidasPor.size) {
      lineas.push(`✅ *Tareas vencidas:* ` + [...vencidasPor.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(' · '));
    }
  } catch (e) {
    console.warn('[digest] tareas no disponibles:', (e as Error).message);
  }

  // ── Uso de Claude ──
  try {
    const u = await getUsageSnapshot();
    if (u.authenticated && (u.pct5h != null || u.pct7d != null)) {
      const alerta = (u.pct7d ?? 0) >= 80 || (u.pct5h ?? 0) >= 80 ? ' ⚠️' : '';
      lineas.push(`🤖 *Claude:* 5h ${u.pct5h ?? '?'}% · semana ${u.pct7d ?? '?'}%${alerta}`);
    } else if (!u.authenticated) {
      lineas.push(`🤖 *Claude:* ⚠️ sin sesión en el VPS — hay que re-loguear`);
    }
  } catch { /* sin uso, sin drama */ }

  lineas.push('', '💬 Dime *"muéstrame la cartera"* o *"llévame a cobros"* y te llevo 😉');
  const texto = lineas.join('\n');

  // ── Publicar como María en el Chat General + push ──
  const fs = admin.firestore();
  await fs.collection('chat_messages').add({
    text: texto,
    senderId: 'ai_assistant',
    senderName: 'María',
    senderPhoto: null,
    images: null,
    createdAt: Date.now(),
    readBy: ['ai_assistant'],
    roomId: GENERAL_ROOM,
  });
  await fs.collection('chat_rooms').doc(GENERAL_ROOM).set(
    { id: GENERAL_ROOM, lastMessage: { text: 'Resumen diario 🌅', senderName: 'María', createdAt: Date.now() }, updatedAt: Date.now() },
    { merge: true }
  );
  try {
    await sendChatPush(GENERAL_ROOM, 'ai_assistant', 'María', `Resumen diario: cartera ${fmtM(cartera)} en ${porCliente.size} clientes`);
  } catch (e) {
    console.warn('[digest] push falló:', (e as Error).message);
  }

  console.log(`[digest] publicado: cartera=${cartera} clientes=${porCliente.size} cobrosHoy=${cobrosHoy.length}`);
  return { ok: true, cartera, clientesConSaldo: porCliente.size, cobrosHoy: cobrosHoy.length };
};
