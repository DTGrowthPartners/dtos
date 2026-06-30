import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import fs from 'fs';
import os from 'os';
import path from 'path';

const router = Router();
router.use(authMiddleware);

const PLAN_LABEL: Record<string, string> = {
  default_claude_max_20x: 'Max (20x)',
  default_claude_max_5x: 'Max (5x)',
  default_claude_pro: 'Pro',
};

// GET /api/ai-usage — estado de la suscripción de Claude en el VPS (Claude Code),
// leído directo de ~/.claude/.credentials.json (ignorando DARIO).
router.get('/', (_req: Request, res: Response) => {
  try {
    const p = path.join(os.homedir(), '.claude', '.credentials.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const o = (d.claudeAiOauth || {}) as {
      accessToken?: string; expiresAt?: number; subscriptionType?: string; rateLimitTier?: string;
    };
    const tier = o.rateLimitTier || '';
    const plan = PLAN_LABEL[tier] ||
      (o.subscriptionType ? o.subscriptionType.charAt(0).toUpperCase() + o.subscriptionType.slice(1) : 'Claude');
    const hasToken = !!(o.accessToken && o.accessToken.length > 0);
    const expiresAt = o.expiresAt || 0;
    const expired = !expiresAt || expiresAt < Date.now();
    const authenticated = hasToken && !expired;

    res.json({
      plan,
      subscriptionType: o.subscriptionType || null,
      rateLimitTier: tier,
      authenticated,
      hasToken,
      expiresInMin: expiresAt ? Math.round((expiresAt - Date.now()) / 60000) : null,
      // El % de uso en vivo requiere un token válido (no disponible si la sesión está cerrada).
      usagePct: null,
    });
  } catch (e: any) {
    res.json({ plan: 'Claude', authenticated: false, hasToken: false, usagePct: null, error: e.message });
  }
});

export default router;
