import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const chatController = new ChatController();

// All chat routes require authentication
router.use(authMiddleware);

// POST /api/chat - Send a message to Kimi AI
router.post('/', chatController.sendMessage.bind(chatController));

// POST /api/chat/vision - Analyze an image with Kimi AI
router.post('/vision', chatController.analyzeImage.bind(chatController));

// POST /api/chat/ai - Send a message to Kimi AI with Function Calling (tools)
router.post('/ai', chatController.sendMessageWithTools.bind(chatController));

export default router;
