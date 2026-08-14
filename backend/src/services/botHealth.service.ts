import axios from 'axios';
import tls from 'tls';
import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification.service';
import { sendPushToUser } from './push.service';

/**
 * Monitor de salud de los bots de WhatsApp.
 * Detecta: canal Whapi desautorizado (hay que escanear QR), backend de María
 * caído y bot David inaccesible. Avisa por notificación in-app + push a los
 * admins y por WhatsApp (vía el bot que siga vivo).
 *
 * Alerta al caer, recordatorio cada 6h mientras siga caído, y aviso de
 * recuperación. Estado persistido en AppConfig (bot_health_state).
 * Se activa con BOT_HEALTH=on.
 */

const prisma = new PrismaClient();

const CHECK_INTERVAL_MS = 5 * 60_000;
const REALERT_MS = 6 * 60 * 60_000;
const STATE_KEY = 'bot_health_state';

const WHAPI_BASE = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const BOT_URL = process.env.BOT_EXTERNO_URL || 'https://david.dtgrowthpartners.com/api/externo/enviar';
const BOT_KEY = process.env.BOT_EXTERNO_KEY || '';
const ALERT_WA = process.env.BOT_ALERT_WA || '573007189383'; // Dairo
const ADMIN_EMAILS = (process.env.BOT_ALERT_EMAILS || 'stiven@dtgrowthpartners.com,dairo@dtos.com,jhonatan@dtgrowthpartners.com')
  .split(',').map((s) => s.trim()).filter(Boolean);

const log = (msg: string) => console.log(`[bot-health] ${new Date().toISOString()} ${msg}`);

interface Check { id: string; nombre: string; run: () => Promise<{ ok: boolean; detalle: string }> }

const CHECKS: Check[] = [
  {
    id: 'whapi-maria',
    nombre: 'Canal WhatsApp (Whapi/María)',
    run: async () => {
      if (!WHAPI_TOKEN) return { ok: true, detalle: 'sin token configurado — check omitido' };
      const r = await axios.get(`${WHAPI_BASE}/health?wakeup=false`, {
        headers: { Authorization: `Bearer ${WHAPI_TOKEN}` }, timeout: 15_000, validateStatus: () => true,
      });
      const status = r.data?.status?.text || `HTTP ${r.status}`;
      if (status === 'AUTH') return { ok: true, detalle: 'autorizado' };
      const necesitaQr = /QR|UNAUTHORIZED|LOGOUT|PAIRING/i.test(String(status));
      return {
        ok: false,
        detalle: necesitaQr
          ? `estado "${status}" — HAY QUE ESCANEAR EL QR en el panel de Whapi`
          : `estado "${status}"`,
      };
    },
  },
  {
    id: 'maria-backend',
    nombre: 'Backend de María (chat DTOS)',
    run: async () => {
      const r = await axios.get('http://127.0.0.1:3456/', { timeout: 10_000, validateStatus: () => true });
      return r.status < 500
        ? { ok: true, detalle: `HTTP ${r.status}` }
        : { ok: false, detalle: `HTTP ${r.status}` };
    },
  },
  {
    id: 'bot-david',
    nombre: 'Bot David (WhatsApp comercial)',
    run: async () => {
      const r = await axios.get('https://david.dtgrowthpartners.com/', { timeout: 15_000, validateStatus: () => true });
      return r.status < 500
        ? { ok: true, detalle: `HTTP ${r.status}` }
        : { ok: false, detalle: `HTTP ${r.status}` };
    },
  },
  {
    id: 'ssl-certs',
    nombre: 'Certificados SSL',
    run: async () => {
      // certbot renueva ~30 días antes de vencer: un cert con <10 días significa
      // que la renovación está fallando (como el 5/ago con os.dtgrowthpartners).
      const dominios = ['os.dtgrowthpartners.com', 'feedback.dtgrowthpartners.com',
        'david.dtgrowthpartners.com', 'maria.dtgrowthpartners.com',
        'mcp2.dtgrowthpartners.com', 'correo.dtgrowthpartners.com'];
      const diasCert = (host: string) => new Promise<number>((resolve, reject) => {
        const s = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
          const cert: any = s.getPeerCertificate();
          s.end();
          resolve(Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000));
        });
        s.on('error', reject);
        s.setTimeout(10_000, () => { s.destroy(); reject(new Error('timeout')); });
      });
      const problemas: string[] = [];
      for (const d of dominios) {
        try {
          const dias = await diasCert(d);
          if (dias < 10) problemas.push(`${d} vence en ${dias} día(s) — la renovación automática está fallando`);
        } catch (e: any) {
          problemas.push(`${d}: ${e?.message || 'sin respuesta TLS'}`);
        }
      }
      return problemas.length
        ? { ok: false, detalle: problemas.join(' · ') }
        : { ok: true, detalle: `${dominios.length} dominios con certificado sano` };
    },
  },
];

type EstadoMap = Record<string, { ok: boolean; desde: string; ultimaAlerta: number }>;

async function getEstado(): Promise<EstadoMap> {
  const row = await prisma.appConfig.findUnique({ where: { key: STATE_KEY } });
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}

async function setEstado(e: EstadoMap) {
  await prisma.appConfig.upsert({
    where: { key: STATE_KEY },
    update: { value: JSON.stringify(e) },
    create: { key: STATE_KEY, value: JSON.stringify(e) },
  });
}

async function avisar(titulo: string, mensaje: string) {
  // 1. In-app + push a los admins
  const admins = await prisma.user.findMany({ where: { email: { in: ADMIN_EMAILS } }, select: { id: true } });
  for (const a of admins) {
    await notificationService.create({
      type: 'bot_health', title: titulo, message: mensaje, recipientId: a.id,
    }).catch((e) => log(`error notif in-app: ${e?.message}`));
    await sendPushToUser(a.id, { title: titulo, body: mensaje, tag: 'bot-health' })
      .catch((e) => log(`error push: ${e?.message}`));
  }
  // 2. WhatsApp por el bot David (si el caído es otro, este canal sigue vivo)
  if (BOT_KEY) {
    await axios.post(BOT_URL, {
      destino: ALERT_WA,
      mensaje: `🤖⚠️ *${titulo}*\n\n${mensaje}`,
      origen: 'dtos_bot_health',
    }, { headers: { 'X-API-Key': BOT_KEY, 'Content-Type': 'application/json; charset=utf-8' }, timeout: 20_000 })
      .catch((e) => log(`WhatsApp de alerta no salió (${e?.message}) — el push sí llegó`));
  }
}

let corriendo = false;

export async function revisarBots() {
  const estado = await getEstado();
  for (const check of CHECKS) {
    let ok = false; let detalle = '';
    try {
      const r = await check.run();
      ok = r.ok; detalle = r.detalle;
    } catch (e: any) {
      ok = false; detalle = e?.message || 'sin respuesta';
    }
    const previo = estado[check.id];
    const ahora = Date.now();

    if (!ok && (!previo || previo.ok)) {
      // acaba de caer
      estado[check.id] = { ok: false, desde: new Date().toISOString(), ultimaAlerta: ahora };
      log(`🔴 ${check.nombre} CAÍDO: ${detalle}`);
      await avisar(`${check.nombre} caído`, detalle);
    } else if (!ok && previo && !previo.ok && ahora - previo.ultimaAlerta > REALERT_MS) {
      // sigue caído: recordatorio cada 6h
      const horas = Math.round((ahora - new Date(previo.desde).getTime()) / 3_600_000);
      estado[check.id] = { ...previo, ultimaAlerta: ahora };
      await avisar(`${check.nombre} sigue caído (${horas}h)`, detalle);
    } else if (ok && previo && !previo.ok) {
      // se recuperó
      estado[check.id] = { ok: true, desde: new Date().toISOString(), ultimaAlerta: 0 };
      log(`🟢 ${check.nombre} recuperado`);
      await avisar(`${check.nombre} recuperado ✅`, `Volvió a funcionar (${detalle}).`);
    } else if (ok && !previo) {
      estado[check.id] = { ok: true, desde: new Date().toISOString(), ultimaAlerta: 0 };
    }
  }
  await setEstado(estado);
}

export function startBotHealth() {
  if (process.env.BOT_HEALTH !== 'on') {
    log('desactivado (BOT_HEALTH != on)');
    return;
  }
  log(`iniciando: ${CHECKS.length} checks cada ${CHECK_INTERVAL_MS / 60000} min`);
  const ciclo = async () => {
    if (corriendo) return;
    corriendo = true;
    try { await revisarBots(); } catch (e: any) { log(`error ciclo: ${e?.message}`); }
    finally { corriendo = false; }
  };
  setTimeout(ciclo, 30_000); // primer chequeo a los 30s del arranque
  setInterval(ciclo, CHECK_INTERVAL_MS);
}
