import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const getFirestore = () => admin.firestore();
const COL = 'pushTokens';
const prisma = new PrismaClient();

// Normaliza un nombre: minúsculas, sin acentos, sin espacios extra.
const norm = (s?: string | null) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Distancia de Levenshtein (para tolerar 1 letra: "Jhonathan" vs "Jhonatan").
const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};

/**
 * Resuelve el usuario por nombre del equipo, tolerante a acentos y a 1 letra de
 * diferencia (ej. "Jhonathan" del tablero vs "Jhonatan" en la BD). Equipo pequeño.
 */
export const resolveTeamUser = async (name: string): Promise<{ id: string } | null> => {
  const t = norm(name);
  if (!t) return null;
  const users = await prisma.user.findMany({ select: { id: true, firstName: true } });
  // 1) exacto (normalizado)
  let u = users.find((x) => norm(x.firstName) === t);
  if (u) return { id: u.id };
  // 2) prefijo común (>=5) o Levenshtein <= 1
  u = users.find((x) => {
    const f = norm(x.firstName);
    if (f.length < 4) return false;
    const pref = Math.min(5, f.length, t.length);
    return f.slice(0, pref) === t.slice(0, pref) || lev(f, t) <= 1;
  });
  return u ? { id: u.id } : null;
};

/** Guarda/actualiza un token FCM para un usuario. */
export const registerPushToken = async (userId: string, token: string, platform?: string) => {
  await getFirestore().collection(COL).doc(token).set(
    { userId, token, platform: platform || null, updatedAt: Date.now() },
    { merge: true }
  );
};

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía una notificación push a todos los dispositivos de un usuario.
 * Limpia automáticamente los tokens inválidos/expirados.
 */
export const sendPushToUser = async (
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; tokens: number }> => {
  const snap = await getFirestore().collection(COL).where('userId', '==', userId).get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return { sent: 0, failed: 0, tokens: 0 };

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: { url: payload.url || '/', ...(payload.tag ? { tag: payload.tag } : {}) },
    webpush: {
      fcmOptions: { link: payload.url || '/' },
      notification: { icon: '/img/logo.png', badge: '/favicon-48x48.png' },
    },
  });

  // Eliminar tokens muertos
  const dead: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        dead.push(tokens[i]);
      }
    }
  });
  await Promise.all(dead.map((t) => getFirestore().collection(COL).doc(t).delete().catch(() => {})));

  return { sent: res.successCount, failed: res.failureCount, tokens: tokens.length };
};

/**
 * Envía push de un mensaje de chat a los participantes de la sala que NO estén
 * activos (online). Lee la sala (chat_rooms) y la presencia (user_presence) de
 * Firestore. No envía a salas de IA. Para el chat general, va a todo el equipo.
 */
export const sendChatPush = async (
  roomId: string,
  senderId: string,
  senderName: string,
  text: string,
  hasImage = false
) => {
  const fs = getFirestore();
  const roomSnap = await fs.collection('chat_rooms').doc(roomId).get();
  if (!roomSnap.exists) return;
  const room = roomSnap.data() as { type?: string; participants?: string[] };
  if (room.type === 'ai') return; // las respuestas de María no notifican

  let recipientIds: string[];
  if (room.type === 'general' || !room.participants?.length) {
    const users = await prisma.user.findMany({ select: { id: true } });
    recipientIds = users.map((u) => u.id).filter((id) => id !== senderId);
  } else {
    // Solo un participante real puede disparar push a su sala.
    if (!room.participants.includes(senderId)) return;
    recipientIds = room.participants.filter((id) => id !== senderId && id !== 'ai_assistant');
  }
  if (!recipientIds.length) return;

  // No molestar a quien ya tiene la app abierta y activa (presencia 'online').
  const presence = await Promise.all(
    recipientIds.map((id) => fs.collection('user_presence').doc(id).get())
  );
  const online = new Set(
    presence.filter((s) => s.exists && (s.data() as { status?: string })?.status === 'online').map((s) => s.id)
  );
  const targets = recipientIds.filter((id) => !online.has(id));
  console.log(
    `[chat push] room=${roomId} type=${room.type || '?'} recipients=${recipientIds.length} online-skip=${online.size} targets=${targets.length}`
  );
  if (!targets.length) return;

  const title = room.type === 'general' ? `${senderName} · Chat General` : senderName;
  const body = (text?.trim() || (hasImage ? '📷 Imagen' : 'Nuevo mensaje')).slice(0, 120);
  const results = await Promise.all(
    targets.map((id) =>
      sendPushToUser(id, { title, body, url: '/', tag: `chat-${roomId}` }).catch((e) => {
        console.error('[chat push] error a', id, (e as Error).message);
        return { sent: 0, failed: 1, tokens: 0 };
      })
    )
  );
  const sent = results.reduce((a, r) => a + r.sent, 0);
  console.log(`[chat push] enviados=${sent} de ${targets.length} destinatario(s)`);
};

/** Envía push al miembro del equipo por nombre (resolución robusta a acentos/typos). */
export const sendPushToMemberName = async (firstName: string, payload: PushPayload) => {
  const user = await resolveTeamUser(firstName);
  if (!user) {
    console.warn('[push] sin usuario para nombre:', firstName);
    return { sent: 0, failed: 0, tokens: 0 };
  }
  return sendPushToUser(user.id, payload);
};
