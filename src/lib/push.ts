import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { apiClient } from './api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

export type EnablePushResult = { ok: boolean; reason?: string };

/**
 * Pide permiso de notificaciones, obtiene el token FCM y lo registra en el backend.
 * Devuelve { ok } o un motivo ('no-soportado' | 'permiso-denegado' | 'sin-token' | error).
 */
export async function enablePush(): Promise<EnablePushResult> {
  try {
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    // En iOS el push SOLO funciona con la PWA instalada (abierta desde el ícono de inicio).
    if (isiOS && !standalone) return { ok: false, reason: 'no-instalada' };

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'no-soportado' };
    }
    if (!(await isSupported())) return { ok: false, reason: 'no-soportado-fcm' };
    if (!VAPID_KEY) return { ok: false, reason: 'sin-vapid' };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permiso-denegado' };

    const reg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: 'sin-token' };

    await apiClient.post('/api/push/register', { token, platform: navigator.userAgent });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Escucha mensajes en primer plano (app abierta) y muestra una notificación local. */
export async function listenForegroundPush() {
  try {
    if (!(await isSupported())) return;
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const n = payload.notification || {};
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(n.title || 'DTOS', { body: n.body || '', icon: '/img/logo.png' });
      }
    });
  } catch {
    /* noop */
  }
}

export const pushPermission = (): NotificationPermission =>
  typeof Notification !== 'undefined' ? Notification.permission : 'default';
