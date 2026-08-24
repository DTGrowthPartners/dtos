import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { authMiddleware } from '../middlewares/auth.middleware';
import { notificationService } from '../services/notification.service';
import { sendPushToUser } from '../services/push.service';

/** NPS trimestral (spec plus/nps-spec-stiven.md). Rutas públicas por token
 *  para el formulario + rutas admin para generar links y ver resultados. */
const router = Router();
const prisma = new PrismaClient();

// Token 12 chars sin ambiguos (0/O, 1/l/I)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
const genToken = () => Array.from(crypto.randomBytes(12)).map((b) => ALFABETO[b % ALFABETO.length]).join('');

const trimestreActual = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
};

const ADMIN_EMAILS = ['stiven@dtgrowthpartners.com', 'dairo@dtos.com', 'jhonatan@dtgrowthpartners.com'];

async function alertar(titulo: string, mensaje: string) {
  const admins = await prisma.user.findMany({ where: { email: { in: ADMIN_EMAILS } }, select: { id: true } });
  for (const a of admins) {
    await notificationService.create({ type: 'nps', title: titulo, message: mensaje, recipientId: a.id }).catch(() => {});
    await sendPushToUser(a.id, { title: titulo, body: mensaje, tag: 'nps' }).catch(() => {});
  }
  if (process.env.BOT_EXTERNO_KEY) {
    await axios.post(process.env.BOT_EXTERNO_URL || 'https://dairo.dtgp.ai/api/externo/enviar', {
      destino: process.env.BOT_ALERT_WA || '573007189383',
      mensaje: `📊 *${titulo}*\n\n${mensaje}`,
      origen: 'dtos_nps',
    }, { headers: { 'X-API-Key': process.env.BOT_EXTERNO_KEY }, timeout: 20_000 }).catch(() => {});
  }
}

// ---------- PÚBLICO (el formulario, sin login) ----------

// GET /api/nps/validar?t=<token>
router.get('/validar', async (req, res) => {
  const token = String(req.query.t || '');
  const envio = await prisma.npsEnvio.findUnique({ where: { token }, include: { respuesta: true } });
  if (!envio) return res.json({ valido: false, motivo: 'desconocido' });
  if (envio.respuesta || envio.estado === 'respondido') return res.json({ valido: false, motivo: 'respondido' });
  if (envio.venceAt < new Date()) return res.json({ valido: false, motivo: 'vencido' });
  const cliente = await prisma.client.findUnique({ where: { id: envio.clienteId }, select: { name: true } });
  res.json({ valido: true, cliente: cliente?.name || 'cliente' });
});

// POST /api/nps/respuesta
router.post('/respuesta', async (req, res) => {
  try {
    const { token, puntaje, comentario, aspectos, quiereLlamada } = req.body || {};
    const envio = await prisma.npsEnvio.findUnique({ where: { token: String(token || '') }, include: { respuesta: true, contacto: true } });
    if (!envio) return res.status(409).json({ ok: false, motivo: 'desconocido' });
    if (envio.respuesta || envio.estado === 'respondido') return res.status(409).json({ ok: false, motivo: 'respondido' });
    if (envio.venceAt < new Date()) return res.status(409).json({ ok: false, motivo: 'vencido' });
    const p = Number(puntaje);
    if (!Number.isInteger(p) || p < 0 || p > 10) return res.status(400).json({ ok: false, motivo: 'puntaje inválido' });

    await prisma.npsRespuesta.create({
      data: {
        envioId: envio.id,
        puntaje: p,
        comentario: typeof comentario === 'string' ? comentario.slice(0, 2000) : null,
        aspectos: Array.isArray(aspectos) ? aspectos.map(String).slice(0, 10) : [],
        quiereLlamada: quiereLlamada === true,
      },
    });
    await prisma.npsEnvio.update({ where: { id: envio.id }, data: { estado: 'respondido' } });

    const cliente = await prisma.client.findUnique({ where: { id: envio.clienteId }, select: { name: true } });
    const nombreCliente = cliente?.name || envio.clienteId;

    // Alertas (spec punto 6)
    if (p <= 6) {
      await alertar(`NPS detractor: ${nombreCliente}`, `${envio.contacto.nombre} puntuó ${p}/10.${comentario ? ` "${String(comentario).slice(0, 150)}"` : ''}`);
    }
    if (quiereLlamada === true) {
      await alertar(`NPS: ${nombreCliente} pide llamada`, `${envio.contacto.nombre} (${p}/10) marcó "quiero que me llamen".`);
    }
    // Diferencia 3+ entre contactos del mismo cliente en el trimestre
    const otras = await prisma.npsRespuesta.findMany({
      where: { envio: { clienteId: envio.clienteId, trimestre: envio.trimestre }, NOT: { envioId: envio.id } },
    });
    for (const o of otras) {
      if (Math.abs(o.puntaje - p) >= 3) {
        await alertar(`NPS dispar en ${nombreCliente}`, `Dos contactos puntuaron muy distinto este trimestre (${o.puntaje} vs ${p}). Vale una llamada.`);
        break;
      }
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, motivo: e?.message });
  }
});

// ---------- ADMIN (con login DTOS) ----------
router.use(authMiddleware);

// POST /api/nps/generar — links del trimestre actual para contactos activos (idempotente)
router.post('/generar', async (req, res) => {
  const trimestre = typeof req.body?.trimestre === 'string' && /^\d{4}-Q[1-4]$/.test(req.body.trimestre)
    ? req.body.trimestre : trimestreActual();
  const contactos = await prisma.npsContacto.findMany({ where: { activo: true } });
  const links: any[] = [];
  for (const c of contactos) {
    let envio = await prisma.npsEnvio.findFirst({ where: { contactoId: c.id, trimestre } });
    if (!envio) {
      envio = await prisma.npsEnvio.create({
        data: {
          contactoId: c.id, clienteId: c.clienteId, trimestre, token: genToken(),
          venceAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
    }
    const cliente = await prisma.client.findUnique({ where: { id: c.clienteId }, select: { name: true } });
    links.push({
      cliente: cliente?.name, contacto: c.nombre, whatsapp: c.whatsapp, estado: envio.estado,
      link: `https://feedback.dtgrowthpartners.com/r/${envio.token}`,
    });
  }
  res.json({ trimestre, total: links.length, links });
});

// GET /api/nps/resumen — score por cuenta + NPS global del trimestre (spec punto 7)
router.get('/resumen', async (req, res) => {
  const trimestre = typeof req.query.trimestre === 'string' ? String(req.query.trimestre) : trimestreActual();
  const respuestas = await prisma.npsRespuesta.findMany({ where: { envio: { trimestre } }, include: { envio: { include: { contacto: true } } } });
  const porCuenta = new Map<string, number[]>();
  for (const r of respuestas) {
    if (!porCuenta.has(r.envio.clienteId)) porCuenta.set(r.envio.clienteId, []);
    porCuenta.get(r.envio.clienteId)!.push(r.puntaje);
  }
  // trimestre anterior para la tendencia
  const [y, q] = trimestre.split('-Q').map(Number);
  const prevTrim = q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
  const prevResp = await prisma.npsRespuesta.findMany({ where: { envio: { trimestre: prevTrim } }, include: { envio: true } });
  const prevPorCuenta = new Map<string, number[]>();
  for (const r of prevResp) {
    if (!prevPorCuenta.has(r.envio.clienteId)) prevPorCuenta.set(r.envio.clienteId, []);
    prevPorCuenta.get(r.envio.clienteId)!.push(r.puntaje);
  }

  const cuentas: any[] = [];
  let promotoras = 0, detractoras = 0;
  for (const [clienteId, puntajes] of porCuenta) {
    const prom = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
    const clase = prom <= 6 ? 'detractor' : prom <= 8 ? 'pasivo' : 'promotor';
    if (clase === 'promotor') promotoras++;
    if (clase === 'detractor') detractoras++;
    const cliente = await prisma.client.findUnique({ where: { id: clienteId }, select: { name: true } });
    const prevP = prevPorCuenta.get(clienteId);
    const prevProm = prevP ? prevP.reduce((a, b) => a + b, 0) / prevP.length : null;
    const detalle = respuestas
      .filter((r) => r.envio.clienteId === clienteId)
      .map((r) => ({
        contacto: r.envio.contacto.nombre, puntaje: r.puntaje, comentario: r.comentario,
        aspectos: r.aspectos, quiereLlamada: r.quiereLlamada, fecha: r.respondidoAt,
      }));
    cuentas.push({
      cliente: cliente?.name, clienteId, promedio: Math.round(prom * 10) / 10, clase,
      anterior: prevProm !== null ? Math.round(prevProm * 10) / 10 : null, detalle,
    });
  }
  const n = porCuenta.size;
  const envios = await prisma.npsEnvio.count({ where: { trimestre } });
  res.json({
    trimestre, trimestreAnterior: prevTrim, enviados: envios, cuentasRespondieron: n,
    nps: n ? Math.round(((promotoras - detractoras) / n) * 100) : null,
    promotoras, detractoras, pasivas: n - promotoras - detractoras,
    cuentas: cuentas.sort((a, b) => a.promedio - b.promedio),
  });
});

// GET /api/nps/cliente/:clienteId — último NPS de la cuenta + tendencia (badge de la ficha)
router.get('/cliente/:clienteId', async (req, res) => {
  const respuestas = await prisma.npsRespuesta.findMany({
    where: { envio: { clienteId: req.params.clienteId } },
    include: { envio: true },
  });
  if (!respuestas.length) return res.json({ tiene: false });
  const porTrim = new Map<string, number[]>();
  for (const r of respuestas) {
    if (!porTrim.has(r.envio.trimestre)) porTrim.set(r.envio.trimestre, []);
    porTrim.get(r.envio.trimestre)!.push(r.puntaje);
  }
  const trims = [...porTrim.keys()].sort(); // "2026-Q3" ordena bien lexicográfico
  const prom = (t: string) => {
    const p = porTrim.get(t)!;
    return Math.round((p.reduce((a, b) => a + b, 0) / p.length) * 10) / 10;
  };
  const actual = trims[trims.length - 1];
  const anterior = trims.length > 1 ? trims[trims.length - 2] : null;
  const promedio = prom(actual);
  res.json({
    tiene: true,
    trimestre: actual,
    promedio,
    clase: promedio <= 6 ? 'detractor' : promedio <= 8 ? 'pasivo' : 'promotor',
    anterior: anterior ? { trimestre: anterior, promedio: prom(anterior) } : null,
  });
});

// GET /api/nps/contactos
router.get('/contactos', async (_req, res) => {
  const contactos = await prisma.npsContacto.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(contactos);
});

export default router;
