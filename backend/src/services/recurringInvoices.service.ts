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

/** Formatea un rango de fechas en español, sin repetir mes/año cuando coinciden. */
const formatRango = (s: Date, e: Date): string => {
  const [sd, sm, sy] = [s.getDate(), s.getMonth(), s.getFullYear()];
  const [ed, em, ey] = [e.getDate(), e.getMonth(), e.getFullYear()];
  if (sy !== ey) return `del ${sd} de ${MESES[sm]} de ${sy} al ${ed} de ${MESES[em]} de ${ey}`;
  if (sm !== em) return `del ${sd} de ${MESES[sm]} al ${ed} de ${MESES[em]} de ${ey}`;
  return `del ${sd} al ${ed} de ${MESES[em]} de ${ey}`;
};

/**
 * Texto del periodo facturado, terminando en la fecha de cobro.
 * - Si las notas del servicio traen la etiqueta "PERIODO=Ds-De" (días de inicio y
 *   fin), se respeta: PERIODO=5-20 con cobro el 20 de junio -> "del 5 al 20 de junio".
 * - Sin etiqueta, el periodo natural es desde el cobro anterior según la frecuencia:
 *   mensual con cobro el 15 de julio -> "del 15 de junio al 15 de julio de 2026".
 */
const buildPeriodo = (notas: string | null | undefined, dueDate: Date, frecuencia: string): string => {
  const m = (notas || '').match(/PERIODO=(\d{1,2})-(\d{1,2})/i);
  if (m) {
    const startDay = parseInt(m[1], 10);
    const endDay = parseInt(m[2], 10);
    const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), endDay);
    const start = new Date(dueDate.getFullYear(), dueDate.getMonth() - (startDay > endDay ? 1 : 0), startDay);
    return formatRango(start, end);
  }
  const start = DAYS_BY_FREQ[frecuencia]
    ? addDays(dueDate, -DAYS_BY_FREQ[frecuencia])
    : addMonths(dueDate, -(MONTHS_BY_FREQ[frecuencia] || 1));
  return formatRango(start, dueDate);
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

/** Frecuencias sub-mensuales: se avanzan por días, no por meses. */
const DAYS_BY_FREQ: Record<string, number> = { semanal: 7, quincenal: 15 };
const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
/** Avanza la fecha de cobro al siguiente periodo según la frecuencia. */
const advance = (date: Date, frecuencia: string): Date =>
  DAYS_BY_FREQ[frecuencia] ? addDays(date, DAYS_BY_FREQ[frecuencia]) : addMonths(date, MONTHS_BY_FREQ[frecuencia] || 1);

export interface RecurringRunResult {
  generated: { cliente: string; servicio: string; monto: number; invoiceNumber: string }[];
  skipped: { cliente: string; motivo: string }[];
  errors: { cliente: string; error: string }[];
}

export interface CuentaGenerada {
  invoiceId: string;
  invoiceNumber: string;
  pdfUrl: string;
  cliente: string;
  servicio: string;
  monto: number;
  concepto: string;
}

// Error de validación "esperado" (el cron lo reporta como omitido, no como error)
const skipError = (msg: string) => Object.assign(new Error(msg), { status: 400, skip: true });

/**
 * Genera la cuenta de cobro (borrador) de UN servicio contratado y avanza su
 * próximo cobro (único → sin más cobros; recurrente → siguiente periodo futuro).
 * La usan el cron de recurrentes y el botón "Generar cuenta" del perfil del cliente.
 */
export const generarCuentaDeServicio = async (
  clientServiceId: string,
  createdBy = 'sistema-recurrente'
): Promise<CuentaGenerada> => {
  const cs = await prisma.clientService.findUnique({
    where: { id: clientServiceId },
    include: {
      client: { select: { id: true, name: true, nit: true } },
      service: { select: { name: true, price: true } },
    },
  });
  if (!cs) throw Object.assign(new Error('Servicio del cliente no encontrado'), { status: 404 });

  const clienteNombre = cs.client?.name || 'Cliente';
  const nit = cs.client?.nit?.trim();
  if (!nit || nit === '0') throw skipError('Cliente sin NIT/identificación válida');
  const precio = cs.precioCliente ?? cs.service?.price ?? 0;
  if (precio <= 0) throw skipError('Servicio sin precio');

  const now = new Date();
  const servicioNombre = cs.service?.name || 'Servicio';
  const esUnico = cs.frecuencia === 'unico';
  const dueDate = (cs.fechaProximoCobro as Date) || now;
  // Pago único: sin periodo (es un proyecto). Recurrente: siempre con el periodo facturado.
  const concepto = esUnico ? servicioNombre : `${servicioNombre} ${buildPeriodo(cs.notas, dueDate, cs.frecuencia)}`;
  const fechaStr = toYMD(now);

  // Observaciones vacías: el PDF imprime la nota estándar de régimen.
  // El número de cuenta es un timestamp por SEGUNDO (viene del nombre del PDF y va
  // impreso dentro): dos generaciones en el mismo segundo chocan y el segundo PDF
  // pisa el archivo del primero. Si el número ya existe, esperar y regenerar.
  let generatedPath = '';
  let invoiceNumber = '';
  for (let intento = 0; intento < 3; intento++) {
    ({ generatedPath, invoiceNumber } = await invoiceService.generateInvoicePdf({
      nombre_cliente: clienteNombre,
      identificacion: nit,
      servicios: [{ descripcion: concepto, cantidad: 1, precio_unitario: precio }],
      observaciones: '',
      concepto,
      fecha: fechaStr,
      servicio_proyecto: servicioNombre,
      cliente_id: cs.client?.id,
    }));
    const dup = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    if (!dup) break;
    await new Promise((r) => setTimeout(r, 1200));
  }

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
      serviceId: cs.serviceId || null,
      observaciones: null,
      filePath: generatedPath,
      status: 'pendiente',
      createdBy,
    },
  });

  // Avanzar fechaProximoCobro (evita que el cron duplique el cobro mañana).
  if (esUnico) {
    await prisma.clientService.update({ where: { id: cs.id }, data: { fechaProximoCobro: null } });
  } else if (cs.fechaProximoCobro) {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let next = advance(cs.fechaProximoCobro as Date, cs.frecuencia);
    let guard = 0;
    while (next.getTime() <= endOfToday.getTime() && guard < 60) {
      next = advance(next, cs.frecuencia);
      guard++;
    }
    await prisma.clientService.update({ where: { id: cs.id }, data: { fechaProximoCobro: next } });
  }

  return {
    invoiceId: createdInvoice.id,
    invoiceNumber,
    pdfUrl: getPublicInvoiceUrl(createdInvoice.id),
    cliente: clienteNombre,
    servicio: servicioNombre,
    monto: precio,
    concepto,
  };
};

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
      client: { status: 'active' }, // cliente desactivado = no se le auto-factura
      frecuencia: { not: 'unico' },
      esComision: false, // comisión = valor variable, no se auto-factura con precio fijo
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
      // 1. Generar PDF + Invoice borrador + avanzar próximo cobro (helper compartido).
      const gen = await generarCuentaDeServicio(cs.id);
      const { invoiceNumber, pdfUrl, servicio: servicioNombre, monto: precio } = gen;

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

      // (El helper ya avanzó fechaProximoCobro al siguiente periodo futuro.)
      result.generated.push({ cliente: clienteNombre, servicio: servicioNombre, monto: precio, invoiceNumber });
      console.log(`[recurring] cuenta generada: ${clienteNombre} #${invoiceNumber} (${precio})`);
    } catch (e) {
      if ((e as any)?.skip) {
        result.skipped.push({ cliente: clienteNombre, motivo: (e as Error).message });
      } else {
        console.error(`[recurring] error con ${clienteNombre}:`, (e as Error).message);
        result.errors.push({ cliente: clienteNombre, error: (e as Error).message });
      }
    }
  }

  console.log(
    `[recurring] resumen: ${result.generated.length} generadas, ${result.skipped.length} omitidas, ${result.errors.length} errores`
  );
  return result;
};
