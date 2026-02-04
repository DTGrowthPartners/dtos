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

export default router;
