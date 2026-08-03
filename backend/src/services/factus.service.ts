import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';

/**
 * Integración con Factus (facturación electrónica DIAN, Halltec).
 * Emite facturas electrónicas a partir de cuentas de cobro existentes.
 * Config por env: FACTUS_BASE_URL (sandbox por defecto), FACTUS_EMAIL,
 * FACTUS_PASSWORD, FACTUS_CLIENT_ID, FACTUS_CLIENT_SECRET.
 */

const prisma = new PrismaClient();

const BASE_URL = () => process.env.FACTUS_BASE_URL || 'https://api-sandbox.factus.com.co';
const esSandbox = () => BASE_URL().includes('sandbox');

// El token dura 1 hora; se cachea y se renueva 2 min antes de vencer.
let tokenCache: { token: string; expiresAt: number } | null = null;

const isConfigured = () =>
  Boolean(process.env.FACTUS_EMAIL && process.env.FACTUS_PASSWORD &&
    process.env.FACTUS_CLIENT_ID && process.env.FACTUS_CLIENT_SECRET);

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 120_000) return tokenCache.token;
  const { data } = await axios.post(`${BASE_URL()}/oauth/token`, {
    grant_type: 'password',
    client_id: process.env.FACTUS_CLIENT_ID,
    client_secret: process.env.FACTUS_CLIENT_SECRET,
    username: process.env.FACTUS_EMAIL,
    password: process.env.FACTUS_PASSWORD,
  }, { timeout: 30_000 });
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function api(): Promise<AxiosInstance> {
  const token = await getToken();
  return axios.create({
    baseURL: BASE_URL(),
    timeout: 60_000,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    validateStatus: () => true, // los errores de validación de Factus traen detalle en el body
  });
}

/** Rango de numeración activo para Factura de Venta (cacheado 10 min) */
let rangoCache: { id: number; at: number } | null = null;
async function rangoFacturaVenta(): Promise<number | undefined> {
  if (rangoCache && Date.now() - rangoCache.at < 600_000) return rangoCache.id;
  const cli = await api();
  const r = await cli.get('/v2/numbering-ranges');
  const rangos: any[] = r.data?.data?.data || r.data?.data || [];
  const rango = rangos.find((x) => x.is_active && !x.is_expired && /factura de venta/i.test(x.document || ''));
  if (!rango) return undefined;
  rangoCache = { id: rango.id, at: Date.now() };
  return rango.id;
}

/** "901.234.567-8" → { id: "901234567", dv: "8" }; sin guion no se manda dv (Factus lo calcula) */
const parseNit = (raw: string) => {
  const limpio = (raw || '').replace(/[.\s]/g, '');
  const m = limpio.match(/^(\d{5,15})-(\d)$/);
  if (m) return { id: m[1], dv: m[2] };
  return { id: limpio.replace(/\D/g, ''), dv: undefined };
};

export interface EmitirOpts {
  tipoPersona?: 'juridica' | 'natural';
  ivaPct?: number;          // 0 (default, no responsable) o 19
  municipio?: string;       // código DANE, default 08001 (Barranquilla)
  sendEmail?: boolean;      // default false: en pruebas no se manda correo al cliente
}

export const factusService = {
  isConfigured,
  esSandbox,

  /** Conexión + rangos de numeración: para el chequeo del panel de pruebas */
  async estado() {
    if (!isConfigured()) return { ok: false, configurado: false, sandbox: esSandbox(), mensaje: 'Faltan credenciales FACTUS_* en el .env' };
    const cli = await api();
    const r = await cli.get('/v2/numbering-ranges');
    if (r.status !== 200) return { ok: false, configurado: true, sandbox: esSandbox(), mensaje: r.data?.message || `HTTP ${r.status}` };
    const rangos: any[] = (r.data?.data?.data || []).filter((x: any) => x.is_active).map((x: any) => ({
      id: x.id, documento: x.document, prefijo: x.prefix, actual: x.current, resolucion: x.resolution_number,
    }));
    return { ok: true, configurado: true, sandbox: esSandbox(), rangos };
  },

  /** Emite (crea y valida ante DIAN) una factura electrónica desde una cuenta de cobro */
  async emitirCuenta(invoiceId: string, opts: EmitirOpts = {}) {
    if (!isConfigured()) throw new Error('Factus no está configurado (FACTUS_* en el .env)');
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Cuenta de cobro no encontrada');
    const client = await prisma.client.findUnique({ where: { id: invoice.clientId } });

    const { id: identificacion, dv } = parseNit(invoice.clientNit || client?.nit || '');
    if (!identificacion) throw new Error('El cliente no tiene NIT/identificación registrada');

    // Heurística: NIT de 9+ dígitos que empieza por 8/9 → persona jurídica
    const tipoPersona = opts.tipoPersona ||
      (identificacion.length >= 9 && /^[89]/.test(identificacion) ? 'juridica' : 'natural');
    const esJuridica = tipoPersona === 'juridica';
    const ivaPct = typeof opts.ivaPct === 'number' && opts.ivaPct > 0 ? opts.ivaPct : 0;
    // Prioridad: municipio elegido en el diálogo → el guardado en la ficha → Barranquilla
    const municipio = opts.municipio || (client as any)?.municipio || '08001';

    const total = Math.round(invoice.totalAmount * 100) / 100;
    // Con IVA el precio del ítem va sin impuestos; sin IVA (no responsable) va excluido
    const base = ivaPct > 0 ? Math.round((total / (1 + ivaPct / 100)) * 100) / 100 : total;
    const totalConIva = ivaPct > 0 ? Math.round(base * (1 + ivaPct / 100) * 100) / 100 : total;

    const referenceCode = `dtos-${invoice.invoiceNumber}`;
    const payload: any = {
      reference_code: referenceCode,
      observation: (invoice.observaciones || '').slice(0, 250) || undefined,
      send_email: opts.sendEmail === true,
      customer: {
        identification_document_code: esJuridica ? '31' : '13',
        identification: identificacion,
        ...(dv && esJuridica ? { dv } : {}),
        legal_organization_code: esJuridica ? '1' : '2',
        tribute_code: 'ZZ',
        ...(esJuridica ? { company: invoice.clientName } : {}),
        names: invoice.clientName,
        address: client?.address || 'No registrada',
        email: client?.email || undefined,
        phone: client?.phone || undefined,
        municipality_code: municipio,
      },
      payment_details: [
        { payment_form: '1', payment_method_code: '47', amount: totalConIva.toFixed(2) },
      ],
      items: [{
        code_reference: invoice.invoiceNumber.slice(0, 20),
        name: (invoice.concepto || invoice.servicio || 'Prestación de servicios profesionales').slice(0, 250),
        quantity: '1',
        price: base.toFixed(2),
        unit_measure_code: '94', // unidad
        standard_code: '1',
        taxes: ivaPct > 0
          ? [{ code: '01', rate: ivaPct.toFixed(2) }]
          : [{ code: '01', rate: '0.00', is_excluded: true }],
        withholding_taxes: [],
      }],
    };
    const rango = await rangoFacturaVenta();
    if (rango) payload.numbering_range_id = rango;

    const cli = await api();
    let r = await cli.post('/v2/bills/validate', payload);

    // 409: quedó una factura pendiente con esa referencia → se elimina y se reintenta
    if (r.status === 409) {
      await cli.delete(`/v2/bills/destroy/reference/${encodeURIComponent(referenceCode)}`);
      r = await cli.post('/v2/bills/validate', payload);
    }

    // Factus devuelve la factura en data.bill o directamente en data según el caso
    const d = r.data?.data;
    const bill = d?.bill || (d?.number ? d : null);
    if (!bill) {
      const errores = r.data?.data?.errors || r.data?.errors;
      const detalle = errores ? JSON.stringify(errores) : (r.data?.message || `HTTP ${r.status}`);
      throw new Error(`Factus rechazó la factura: ${detalle}`);
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        factusReference: referenceCode,
        factusNumber: bill.number,
        factusCufe: bill.cufe || null,
        factusStatus: bill.is_validated ? 'validada' : 'pendiente',
        factusValidatedAt: bill.is_validated ? new Date() : null,
      },
    });

    // El municipio elegido explícitamente queda en la ficha del cliente para las próximas
    if (client && opts.municipio && opts.municipio !== (client as any).municipio) {
      await prisma.client.update({ where: { id: client.id }, data: { municipio } as any }).catch(() => {});
    }

    // Las "notificaciones" DIAN (p. ej. FAJ44b) son advertencias, no rechazos
    const notificaciones = bill.errors && typeof bill.errors === 'object'
      ? Object.values(bill.errors as Record<string, string>) : [];

    return {
      ok: true,
      sandbox: esSandbox(),
      number: bill.number,
      cufe: bill.cufe || null,
      total: bill.total,
      validated: Boolean(bill.is_validated),
      validatedAt: bill.validated_at || null,
      qr: bill.qr || null,
      notificaciones,
    };
  },

  /** PDF oficial DIAN de la factura emitida (Buffer + nombre de archivo) */
  async descargarPdf(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice?.factusNumber) throw new Error('Esta cuenta no tiene factura electrónica emitida');
    const cli = await api();
    const r = await cli.get(`/v2/bills/${encodeURIComponent(invoice.factusNumber)}/download-pdf`);
    const b64 = r.data?.data?.pdf_base_64_encoded;
    if (!b64) throw new Error(r.data?.message || 'Factus no devolvió el PDF');
    return {
      buffer: Buffer.from(b64, 'base64'),
      fileName: `${r.data?.data?.file_name || invoice.factusNumber}.pdf`,
    };
  },
};
