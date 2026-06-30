import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import admin from 'firebase-admin';

const router = Router();
router.use(authMiddleware);

// GET /api/ai-usage — uso semanal de la IA (respuestas de María en el chat), últimas 8 semanas.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('chat_messages').where('senderId', '==', 'ai_assistant').get();
    const times = snap.docs.map((d) => Number(d.data().createdAt) || 0).filter(Boolean);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dow = (startOfDay.getDay() + 6) % 7; // lunes = 0
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - dow);
    const WEEK = 7 * 86400000;

    const weekly: { label: string; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const s = weekStart.getTime() - w * WEEK;
      const e = s + WEEK;
      const count = times.filter((t) => t >= s && t < e).length;
      const d = new Date(s);
      weekly.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, count });
    }

    res.json({
      today: times.filter((t) => t >= startOfDay.getTime()).length,
      thisWeek: weekly[weekly.length - 1].count,
      lastWeek: weekly[weekly.length - 2]?.count || 0,
      total: times.length,
      weekly,
    });
  } catch (e: any) {
    console.error('[ai-usage] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
