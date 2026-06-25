import { Request, Response } from 'express';
import { registerPushToken, sendPushToUser } from '../services/push.service';

export const register = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { token, platform } = req.body;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    if (!token) return res.status(400).json({ message: 'Falta token' });
    await registerPushToken(userId, token, platform);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const test = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const r = await sendPushToUser(userId, {
      title: 'DTOS',
      body: '🔔 ¡Las notificaciones push funcionan!',
      url: '/',
    });
    res.json({ success: true, ...r });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};
