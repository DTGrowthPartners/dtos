#!/usr/bin/env node
// Alerta de smoke test fallido → WhatsApp (bot Dairo) al equipo.
// Uso: node alert.js /tmp/last_smoke.json
// Lee TEAM_PHONES / URGENT_TASKS_PHONE / AGENT_DAIRO_API_KEY del .env del backend
// (parse manual para no depender de dotenv en la raíz del repo).
const fs = require('fs');

const readEnv = (path) => {
  const env = {};
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin .env */ }
  return env;
};

(async () => {
  const env = readEnv('/home/ubuntu/dtos/backend/.env');
  const file = process.argv[2];

  let fails = [];
  try {
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    fails = (r.results || [])
      .filter((x) => x.status === 'FAIL')
      .map((x) => `• [${x.category}] ${x.name}: ${x.detail}`);
  } catch { /* json ilegible: alerta genérica */ }

  let phones = {};
  try { phones = JSON.parse(env.TEAM_PHONES || '{}'); } catch { /* ignore */ }
  const destino = phones['Stiven'] || phones['Dairo'] || env.URGENT_TASKS_PHONE;
  if (!destino) { console.log('sin destino WhatsApp configurado (TEAM_PHONES)'); return; }

  const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const mensaje =
    `🚨 *Smoke test DTOS falló*\n` +
    (fails.slice(0, 6).join('\n') || 'No se pudo leer el detalle (ver /tmp/last_smoke.json)') +
    (fails.length > 6 ? `\n… y ${fails.length - 6} más` : '') +
    `\n🕐 ${hora}`;

  const res = await fetch('https://david.dtgrowthpartners.com/api/externo/enviar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': env.AGENT_DAIRO_API_KEY || '' },
    body: JSON.stringify({ destino, mensaje, origen: 'dtos-smoke' }),
  });
  console.log('alerta WhatsApp enviada, status', res.status);
})().catch((e) => console.log('alert error:', e.message));
