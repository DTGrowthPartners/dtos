import { Router, Request, Response } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { sendChatPush } from '../services/push.service';

const router = Router();
const chatController = new ChatController();

// All chat routes require authentication
router.use(authMiddleware);

// POST /api/chat/notify - Push a los participantes (no-IA) que no estén activos
router.post('/notify', (req: Request, res: Response) => {
  const senderId = (req as any).user?.userId;
  const { roomId, senderName, text, hasImage } = req.body || {};
  if (!roomId || !senderId) return res.status(400).json({ error: 'roomId requerido' });
  console.log(`[chat push] /notify room=${roomId} sender=${senderId} (${senderName || '?'})`);
  // fire-and-forget: no bloquear el envío del mensaje
  sendChatPush(roomId, senderId, senderName || 'Alguien', text || '', !!hasImage)
    .catch((e) => console.error('[chat push] falló:', (e as Error).message));
  res.json({ success: true });
});

// POST /api/chat - Send a message to Kimi AI
router.post('/', chatController.sendMessage.bind(chatController));

// POST /api/chat/vision - Analyze an image with Kimi AI
router.post('/vision', chatController.analyzeImage.bind(chatController));

// POST /api/chat/ai - Send a message to Kimi AI with Function Calling (tools)
router.post('/ai', chatController.sendMessageWithTools.bind(chatController));

export default router;
