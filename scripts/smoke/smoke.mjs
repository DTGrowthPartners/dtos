#!/usr/bin/env node
// -----------------------------------------------------------------------------
// DTOS · Smoke tests
// -----------------------------------------------------------------------------
// Prueba rápida "¿está todo vivo?" de producción. Pensado para que un subagente
// barato (Codex / Claude Haiku) lo corra cada cierto tiempo y avise si algo se
// rompió: login, chat/notificaciones, finanzas, IA, CRM, etc.
//
// NO instala nada: usa fetch nativo de Node 18+. No modifica datos (solo lee),
// salvo un POST /api/chat/notify a una sala inexistente (no envía push a nadie).
//
// Uso:
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke/smoke.mjs
//   node scripts/smoke/smoke.mjs --json        # salida JSON para automatizar
//   node scripts/smoke/smoke.mjs --verbose      # imprime cuerpos en fallos
//
// Variables de entorno:
//   SMOKE_BASE_URL   (default https://os.dtgrowthpartners.com)
//   SMOKE_EMAIL      credenciales de una cuenta de prueba (obligatorio)
//   SMOKE_PASSWORD   contraseña de esa cuenta (obligatorio)
//   SMOKE_TIMEOUT_MS (default 15000)
//
// Exit code: 0 = todo OK (los WARN no cuentan como fallo) · 1 = algún FAIL.
// -----------------------------------------------------------------------------

const BASE = (process.env.SMOKE_BASE_URL || 'https://os.dtgrowthpartners.com').replace(/\/$/, '');
const EMAIL = process.env.SMOKE_EMAIL || '';
const PASSWORD = process.env.SMOKE_PASSWORD || '';
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const JSON_OUT = process.argv.includes('--json');
const VERBOSE = process.argv.includes('--verbose');

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', bold: '\x1b[1m',
};
const paint = (s, c) => (JSON_OUT ? s : `${c}${s}${C.reset}`);

const results = [];
let TOKEN = '';

// --- helper de fetch con timeout ---------------------------------------------
async function http(method, path, { token, body, headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const t0 = performance.now();
  try {
    const url = path.startsWith('http') ? path : BASE + path;
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Math.round(performance.now() - t0);
    const ct = res.headers.get('content-type') || '';
    let data = null, text = '';
    if (ct.includes('application/json')) { try { data = await res.json(); } catch { /* ignore */ } }
    else { text = await res.text(); }
    return { ok: res.ok, status: res.status, headers: res.headers, data, text, ms };
  } finally {
    clearTimeout(timer);
  }
}

// --- runner ------------------------------------------------------------------
// severity: 'fail' (rompe el smoke) | 'warn' (avisa pero no rompe)
async function check(name, category, severity, fn) {
  const t0 = performance.now();
  try {
    const detail = await fn();
    results.push({ name, category, status: 'PASS', severity, detail: detail || '', ms: Math.round(performance.now() - t0) });
  } catch (e) {
    const failed = severity === 'warn' ? 'WARN' : 'FAIL';
    results.push({ name, category, status: failed, severity, detail: e.message, ms: Math.round(performance.now() - t0) });
    if (VERBOSE && e.body) console.error(paint(`   └ body: ${JSON.stringify(e.body).slice(0, 400)}`, C.gray));
  }
}

// aserciones cortas
function assert(cond, msg, body) {
  if (!cond) { const e = new Error(msg); e.body = body; throw e; }
}

// -----------------------------------------------------------------------------
// Definición de los checks
// -----------------------------------------------------------------------------
async function run() {
  // 1) Frontend sirve y el bundle JS referenciado carga (detecta pantalla blanca / bundle viejo)
  await check('Frontend carga y bundle JS accesible', 'frontend', 'fail', async () => {
    const r = await http('GET', '/');
    assert(r.status === 200, `GET / devolvió ${r.status}`, r.text);
    const html = r.text || '';
    assert(/<div id="root"/.test(html) || /<script/.test(html), 'index.html sin <div id=root> ni <script>');
    const m = html.match(/(?:src|href)="(\/assets\/[^"']+\.js)"/);
    if (m) {
      const asset = await http('GET', m[1]);
      assert(asset.status === 200, `bundle ${m[1]} devolvió ${asset.status} (¿deploy a medias?)`);
      return `bundle ${m[1].split('/').pop()} OK (${r.ms}ms)`;
    }
    return `index OK (${r.ms}ms, sin bundle detectable)`;
  });

  // 2) Service worker de push con no-cache (regresión típica de "no llegan notificaciones")
  await check('firebase-messaging-sw.js con no-cache', 'notificaciones', 'warn', async () => {
    const r = await http('GET', '/firebase-messaging-sw.js');
    assert(r.status === 200, `SW devolvió ${r.status}`);
    const cc = (r.headers.get('cache-control') || '').toLowerCase();
    assert(cc.includes('no-cache') || cc.includes('no-store') || cc.includes('max-age=0'),
      `SW sin no-cache (Cache-Control: "${cc || 'ausente'}") → el navegador puede quedarse con push viejo`);
    return `Cache-Control: ${cc}`;
  });

  // 3) Health check del backend
  await check('Backend /api/health', 'backend', 'fail', async () => {
    const r = await http('GET', '/api/health');
    assert(r.status === 200, `health devolvió ${r.status} (backend caído / 502)`, r.text);
    assert(r.data && r.data.status === 'OK', `health sin status OK`, r.data);
    return `status OK (${r.ms}ms)`;
  });

  // 4) Auth middleware rechaza sin token (seguridad)
  await check('Ruta protegida rechaza sin token (401)', 'auth', 'fail', async () => {
    const r = await http('GET', '/api/finance/data');
    assert(r.status === 401 || r.status === 403, `esperaba 401/403, dio ${r.status} (¡middleware de auth roto!)`, r.data);
    return `rechaza con ${r.status}`;
  });

  // 5) Login con credenciales válidas → token
  await check('Login (credenciales válidas)', 'auth', 'fail', async () => {
    assert(EMAIL && PASSWORD, 'faltan SMOKE_EMAIL / SMOKE_PASSWORD (exporta las credenciales de prueba)');
    const r = await http('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
    assert(r.status === 200, `login devolvió ${r.status}`, r.data);
    assert(r.data && typeof r.data.token === 'string' && r.data.token.length > 20, 'login sin token válido', r.data);
    TOKEN = r.data.token;
    return `token recibido, user=${r.data?.user?.email || '?'} (${r.ms}ms)`;
  });

  // 6) Login con contraseña incorrecta → rechazado (que no entre cualquiera)
  await check('Login rechaza contraseña incorrecta', 'auth', 'fail', async () => {
    if (!EMAIL) throw new Error('sin SMOKE_EMAIL, no se puede probar');
    const r = await http('POST', '/api/auth/login', { body: { email: EMAIL, password: 'contraseña-incorrecta-smoke-xyz' } });
    assert(r.status !== 200, `¡login aceptó una contraseña incorrecta! (status ${r.status})`, r.data);
    return `rechaza con ${r.status}`;
  });

  // A partir de aquí necesitamos token. Si no lo hay, marcamos el resto como skip vía WARN.
  const authed = { token: TOKEN };
  const needToken = () => assert(TOKEN, 'sin token (login falló) → no se pudo probar');

  // 7) Notificaciones (el endpoint que dio 502 en su momento)
  await check('GET /api/notifications', 'notificaciones', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/notifications', authed);
    assert(r.status === 200, `notifications devolvió ${r.status}`, r.data);
    return `OK (${r.ms}ms)`;
  });

  // 8) Finanzas (lee Google Sheets en vivo)
  await check('GET /api/finance/data', 'finanzas', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/finance/data', authed);
    assert(r.status === 200, `finance/data devolvió ${r.status}`, r.data);
    assert(r.data && typeof r.data === 'object', 'finance/data sin JSON', r.data);
    return `OK (${r.ms}ms)`;
  });

  // 9) Uso de IA / suscripción Claude (detecta token de Claude vencido en el VPS)
  await check('GET /api/ai-usage (token Claude vivo)', 'ia', 'warn', async () => {
    needToken();
    const r = await http('GET', '/api/ai-usage', authed);
    assert(r.status === 200, `ai-usage devolvió ${r.status}`, r.data);
    assert(r.data && r.data.authenticated === true,
      `Claude NO autenticado en el VPS (plan=${r.data?.plan}, hasToken=${r.data?.hasToken}) → renovar credenciales`, r.data);
    return `plan=${r.data.plan}, 5h=${r.data.pct5h ?? '?'}% 7d=${r.data.pct7d ?? '?'}%`;
  });

  // 10) Clientes
  await check('GET /api/clients', 'clientes', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/clients', authed);
    assert(r.status === 200, `clients devolvió ${r.status}`, r.data);
    const n = Array.isArray(r.data) ? r.data.length : (Array.isArray(r.data?.data) ? r.data.data.length : '?');
    return `${n} clientes (${r.ms}ms)`;
  });

  // 11) Cobros & MRR
  await check('GET /api/cobros', 'finanzas', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/cobros', authed);
    assert(r.status === 200, `cobros devolvió ${r.status}`, r.data);
    return `OK (${r.ms}ms)`;
  });

  // 12) CRM: etapas y deals (pipeline)
  await check('GET /api/crm/stages', 'crm', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/crm/stages', authed);
    assert(r.status === 200, `crm/stages devolvió ${r.status}`, r.data);
    return `OK (${r.ms}ms)`;
  });
  await check('GET /api/crm/deals', 'crm', 'fail', async () => {
    needToken();
    const r = await http('GET', '/api/crm/deals', authed);
    assert(r.status === 200, `crm/deals devolvió ${r.status}`, r.data);
    return `OK (${r.ms}ms)`;
  });

  // 13) Chat push: el endpoint de notificar responde (sala inexistente → no envía push a nadie)
  await check('POST /api/chat/notify (endpoint push vivo)', 'chat', 'fail', async () => {
    needToken();
    const r = await http('POST', '/api/chat/notify', {
      token: TOKEN,
      body: { roomId: '__smoke_test_room__', senderName: 'Smoke Test', text: '(ping de prueba, ignorar)' },
    });
    assert(r.status === 200, `chat/notify devolvió ${r.status}`, r.data);
    assert(r.data && r.data.success === true, 'chat/notify sin success:true', r.data);
    return `OK (${r.ms}ms)`;
  });
}

// -----------------------------------------------------------------------------
// Reporte
// -----------------------------------------------------------------------------
(async () => {
  const started = new Date().toISOString();
  await run();

  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  const passes = results.filter((r) => r.status === 'PASS');

  if (JSON_OUT) {
    console.log(JSON.stringify({
      ok: fails.length === 0,
      base: BASE,
      startedAt: started,
      summary: { total: results.length, pass: passes.length, warn: warns.length, fail: fails.length },
      results,
    }, null, 2));
  } else {
    console.log(`\n${paint('DTOS · Smoke tests', C.bold + C.cyan)}  ${paint(BASE, C.gray)}`);
    console.log(paint('─'.repeat(60), C.gray));
    for (const r of results) {
      const icon = r.status === 'PASS' ? paint('✓ PASS', C.green)
        : r.status === 'WARN' ? paint('⚠ WARN', C.yellow)
        : paint('✗ FAIL', C.red);
      const cat = paint(`[${r.category}]`, C.gray);
      console.log(`${icon} ${cat} ${r.name}`);
      console.log(paint(`        ${r.detail}  ·  ${r.ms}ms`, C.gray));
    }
    console.log(paint('─'.repeat(60), C.gray));
    const line = `${passes.length} PASS · ${warns.length} WARN · ${fails.length} FAIL`;
    console.log(fails.length ? paint(`✗ ${line}`, C.red + C.bold) : paint(`✓ ${line}`, C.green + C.bold));
    if (fails.length) {
      console.log(paint('\nFallos:', C.red));
      for (const f of fails) console.log(paint(`  • [${f.category}] ${f.name}: ${f.detail}`, C.red));
    }
    if (warns.length) {
      console.log(paint('\nAvisos (revisar, no bloquean):', C.yellow));
      for (const w of warns) console.log(paint(`  • [${w.category}] ${w.name}: ${w.detail}`, C.yellow));
    }
  }

  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(paint(`Error fatal del smoke test: ${e.stack || e.message}`, C.red));
  process.exit(2);
});
