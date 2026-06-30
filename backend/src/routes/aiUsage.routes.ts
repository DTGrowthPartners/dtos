import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import axios from 'axios';

const router = Router();
router.use(authMiddleware);

// Proxy de Claude (suscripción) que corre en el VPS.
const DARIO_URL = process.env.CHAT_AI_BASE_URL?.replace(/\/v1\/?$/, '') || 'http://localhost:3456';

// GET /api/ai-usage — estado del Claude del VPS (DARIO): salud, oauth y requests.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const r = await axios.get(`${DARIO_URL}/`, { timeout: 4000 });
    const d = r.data || {};
    res.json({
      plan: process.env.CLAUDE_PLAN || 'Max (20x)',
      reachable: true,
      status: d.status || 'unknown',           // ok | degraded
      oauth: d.oauth || 'unknown',              // ok | broken
      requests: typeof d.requests === 'number' ? d.requests : null,
      refreshFailures: typeof d.refreshFailures === 'number' ? d.refreshFailures : null,
      lastError: d.lastRefreshError || null,
    });
  } catch (e: any) {
    res.json({ plan: process.env.CLAUDE_PLAN || 'Max (20x)', reachable: false, status: 'down', oauth: 'unknown', requests: null, error: e.message });
  }
});

export default router;
