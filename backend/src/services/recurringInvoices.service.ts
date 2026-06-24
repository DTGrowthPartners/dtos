import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import { invoiceService, getPublicInvoiceUrl } from './invoice.service';
import { agentSendMessage } from './agents.service';
import { resolveDestino } from '../config/notifyPhones';

const prisma = new PrismaClient();
const getFirestore = () => admin.firestore();

const MONTHS_BY_FREQ: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Si las notas del servicio incluyen una etiqueta "PERIODO=Ds-De" (días de inicio y
 * fin del periodo de cobro), arma el texto del periodo terminando en la fecha de
 * cobro. Si Ds > De, el inicio cae en el mes anterior. Ej: PERIODO=5-20 con cobro
 * el 20 de junio -> "del 5 al 20 de junio de 2026".
 */
const buildPeriodo = (notas: string | null | undefined, dueDate: Date): string | null => {
  const m = (notas || '').match(/PERIODO=(\d{1,2})-(\d{1,2})/i);
  if (!m) return null;
  const startDay = parseInt(m[1], 10);
  const endDay = parseInt(m[2], 10);
  const endMonth = dueDate.getMonth();
  const endYear = dueDate.getFullYear();
  let startMonth = endMonth;
  let startYear = endYear;
  if (startDay > endDay) {
    startMonth = endMonth - 1;
    if (startMonth < 0) { startMonth = 11; startYear = endYear - 1; }
  }
  if (startMonth === endMonth) {
    return `del ${startDay} al ${endDay} de ${MESES[endMonth]} de ${endYear}`;
  }
  return `del ${startDay} de ${MESES[startMonth]} al ${endDay} de ${MESES[endMonth]} de ${endYear}`;
};

/** Avanza una fecha N meses preservando el dia (clamp a fin de mes). */
const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

export interface RecurringRunResult {
  generated: { cliente: string; servicio: string; monto: number; invoiceNumber: string }[];
  skipped: { cliente: string; motivo: string }[];
  errors: { cliente: string; error: string }[];
}

/**
 * Genera las cuentas de cobro (borrador) de los servicios recurrentes cuya
 * fechaProximoCobro ya llego. Por cada una:
 *  1. Genera el PDF + registra Invoice (status 'pendiente' = borrador).
 *  2. Crea una tarea de ALTA prioridad asignada a Dairo (revisar y enviar).
 *  3. Avisa a Dairo por WhatsApp.
 *  4. Avanza fechaProximoCobro al siguiente periodo (no duplica).
 */
export const generateDueRecurringInvoices = async (): Promise<RecurringRunResult> => {
  const result: RecurringRunResult = { generated: [], skipped: [], errors: [] };

  // Fin del dia de hoy (para incluir cobros de hoy)
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const dueServices = await prisma.clientService.findMany({
    where: {
      estado: 'activo',
      frecuencia: { not: 'unico' },
      fechaProximoCobro: { not: null, lte: endOfToday },
    },
    include: {
      client: { select: { id: true, name: true, nit: true } },
      service: { select: { name: true, price: true } },
    },
  });

  for (const cs of dueServices) {
    const clienteNombre = cs.client?.name || 'Cliente';
    try {
      const nit = cs.client?.nit?.trim();
      if (!nit || nit === '0') {
        result.skipped.push({ cliente: clienteNombre, motivo: 'Cliente sin NIT/identificación válida' });
        continue;
      }
      const precio = cs.precioCliente ?? cs.service?.price ?? 0;
      if (precio <= 0) {
        result.skipped.push({ cliente: clienteNombre, motivo: 'Servicio sin precio' });
        continue;
      }

      const servicioNombre = cs.service?.name || 'Servicio mensual';
      const fechaStr = toYMD(now);
      // Periodo en el concepto (si el servicio tiene etiqueta PERIODO=Ds-De en notas).
      const periodo = buildPeriodo(cs.notas, (cs.fechaProximoCobro as Date) || now);
      const descripcion = periodo ? `${servicioNombre} ${periodo}` : servicioNombre;
      const concepto = periodo ? `${servicioNombre} ${periodo}` : `Servicio ${cs.frecuencia} — ${servicioNombre}`;

      // 1. Generar PDF + registrar Invoice como borrador (status 'pendiente').
      const { generatedPath, invoiceNumber } = await invoiceService.generateInvoicePdf({
        nombre_cliente: clienteNombre,
        identificacion: nit,
        servicios: [{ descripcion, cantidad: 1, precio_unitario: precio }],
        observaciones: 'Generada automáticamente (servicio recurrente). Borrador para revisión.',
        concepto,
        fecha: fechaStr,
        servicio_proyecto: servicioNombre,
        cliente_id: cs.client?.id,
      });

      const createdInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          clientId: cs.client?.id || '',
          clientName: clienteNombre,
          clientNit: nit,
          totalAmount: precio,
          fecha: new Date(fechaStr),
          concepto,
          servicio: servicioNombre,
          observaciones: 'Generada automáticamente (servicio recurrente).',
          filePath: generatedPath,
          status: 'pendiente',
          createdBy: 'sistema-recurrente',
        },
      });

      // Link público firmado para descargar/enviar el PDF directamente.
      const pdfUrl = getPublicInvoiceUrl(createdInvoice.id);

      // 2. Crear tarea de ALTA prioridad para Dairo en Firestore.
      const taskTitle = `Revisar y enviar cuenta de cobro — ${clienteNombre}`;
      const taskDesc =
        `Cuenta #${invoiceNumber} generada automáticamente por el servicio recurrente "${servicioNombre}" ` +
        `(${precio.toLocaleString('es-CO')} COP). Está como borrador: revísala y envíala al cliente.\n` +
        `PDF: ${pdfUrl}`;
      try {
        await getFirestore().collection('tasks').add({
          title: taskTitle,
          description: taskDesc,
          status: 'TODO',
          priority: 'HIGH',
          assignee: 'Dairo',
          creator: 'Sistema',
          projectId: '',
          type: 'Cliente / Reuniones',
          position: 0,
          createdAt: Date.now(),
        });
      } catch (e) {
        console.error('[recurring] no se pudo crear la tarea en Firestore:', (e as Error).message);
      }

      // 3. Avisar a Dairo por WhatsApp (mismo canal que tareas urgentes).
      const destino = resolveDestino('Dairo');
      if (destino) {
        const mensaje =
          `🔴 *Cuenta de cobro lista para revisar*\n` +
          `*${clienteNombre}* — ${precio.toLocaleString('es-CO')} COP\n` +
          `Servicio: ${servicioNombre} (${cs.frecuencia})\n` +
          `Cuenta #${invoiceNumber} generada como borrador.\n` +
          `📄 PDF: ${pdfUrl}\n` +
          `Revísala y envíala al cliente.`;
        try {
          await agentSendMessage('dairo', { destino, mensaje, origen: 'dtos_cuentas_recurrentes' });
        } catch (e) {
          console.error('[recurring] no se pudo avisar por WhatsApp:', (e as Error).message);
        }
      }

      // 4. Avanzar fechaProximoCobro al siguiente periodo futuro (evita duplicados).
      const step = MONTHS_BY_FREQ[cs.frecuencia] || 1;
      let next = addMonths(cs.fechaProximoCobro as Date, step);
      // Si sigue en el pasado (servicio muy atrasado), saltar hasta futuro sin generar de mas.
      let guard = 0;
      while (next.getTime() <= endOfToday.getTime() && guard < 60) {
        next = addMonths(next, step);
        guard++;
      }
      await prisma.clientService.update({
        where: { id: cs.id },
        data: { fechaProximoCobro: next },
      });

      result.generated.push({ cliente: clienteNombre, servicio: servicioNombre, monto: precio, invoiceNumber });
      console.log(`[recurring] cuenta generada: ${clienteNombre} #${invoiceNumber} (${precio})`);
    } catch (e) {
      console.error(`[recurring] error con ${clienteNombre}:`, (e as Error).message);
      result.errors.push({ cliente: clienteNombre, error: (e as Error).message });
    }
  }

  console.log(
    `[recurring] resumen: ${result.generated.length} generadas, ${result.skipped.length} omitidas, ${result.errors.length} errores`
  );
  return result;
};
