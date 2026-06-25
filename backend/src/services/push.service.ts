import admin from 'firebase-admin';

const getFirestore = () => admin.firestore();
const COL = 'pushTokens';

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

/** Envía push al usuario cuyo firstName coincide (mapea nombre del equipo -> userId). */
export const sendPushToMemberName = async (firstName: string, payload: PushPayload) => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { firstName: { equals: firstName, mode: 'insensitive' } }, select: { id: true } });
  if (!user) return { sent: 0, failed: 0, tokens: 0 };
  return sendPushToUser(user.id, payload);
};
