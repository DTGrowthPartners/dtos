/**
 * Destinos de WhatsApp para notificaciones (via bot Dairo /api/externo/enviar).
 *
 * Config por ENV (no se commitea):
 *  - TEAM_PHONES: JSON map nombre->destino. Ej:
 *      {"Stiven":"+573001112233","Dairo":"+573004445566","Lía":"573007778899@s.whatsapp.net"}
 *  - URGENT_TASKS_PHONE: destino fallback cuando el asignado no tiene número
 *    (puede ser un número o el id de un grupo @g.us).
 *
 * destino acepta: "+573001234567", "573001234567@s.whatsapp.net" o "...@g.us".
 */

let cachedMap: Record<string, string> | null = null;

const getTeamPhones = (): Record<string, string> => {
  if (cachedMap) return cachedMap;
  try {
    cachedMap = process.env.TEAM_PHONES ? JSON.parse(process.env.TEAM_PHONES) : {};
  } catch (e) {
    console.error('[notifyPhones] TEAM_PHONES no es JSON válido:', (e as Error).message);
    cachedMap = {};
  }
  return cachedMap!;
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

/**
 * Resuelve el destino WhatsApp para un miembro del equipo.
 * Devuelve el número/grupo configurado, o el fallback URGENT_TASKS_PHONE, o null.
 */
export const resolveDestino = (memberName?: string): string | null => {
  const map = getTeamPhones();
  if (memberName) {
    // match exacto, luego normalizado (sin tildes/case)
    if (map[memberName]) return map[memberName];
    const target = norm(memberName);
    const hit = Object.keys(map).find((k) => norm(k) === target);
    if (hit) return map[hit];
  }
  return process.env.URGENT_TASKS_PHONE || null;
};
