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

// Modelo barato para "pinguear" y leer los headers de rate-limit de la suscripción.
const PING_MODEL = process.env.CLAUDE_PING_MODEL || 'claude-haiku-4-5-20251001';

// Caché en memoria para no gastar en cada carga del dashboard.
let cache: { ts: number; data: any } = { ts: 0, data: null };
const TTL = 5 * 60 * 1000; // 5 min

const readCreds = () => {
  const p = path.join(os.homedir(), '.claude', '.credentials.json');
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (d.claudeAiOauth || {}) as { accessToken?: string; expiresAt?: number; subscriptionType?: string; rateLimitTier?: string };
};

// Consulta el uso real (utilización 5h y 7d) llamando a la API con el token OAuth.
const fetchUsage = async (token: string) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'user-agent': 'claude-cli/1.0',
      },
      body: JSON.stringify({
        model: PING_MODEL,
        max_tokens: 1,
        system: "You are Claude Code, Anthropic's official CLI for Claude.",
        messages: [{ role: 'user', content: '.' }],
      }),
    });
    const h = r.headers;
    const num = (k: string) => { const v = h.get(k); return v != null && v !== '' ? Number(v) : null; };
    const u5 = num('anthropic-ratelimit-unified-5h-utilization');
    const u7 = num('anthropic-ratelimit-unified-7d-utilization');
    if (u5 == null && u7 == null) return null;
    return {
      pct5h: u5 != null ? Math.round(u5 * 100) : null,
      pct7d: u7 != null ? Math.round(u7 * 100) : null,
      reset5h: num('anthropic-ratelimit-unified-5h-reset'),   // unix seconds
      reset7d: num('anthropic-ratelimit-unified-7d-reset'),
      status: h.get('anthropic-ratelimit-unified-status') || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// GET /api/ai-usage — plan, sesión y uso real (5h / 7d) de la suscripción de Claude en el VPS.
router.get('/', async (req: Request, res: Response) => {
  try {
    const o = readCreds();
    const tier = o.rateLimitTier || '';
    const plan = PLAN_LABEL[tier] ||
      (o.subscriptionType ? o.subscriptionType.charAt(0).toUpperCase() + o.subscriptionType.slice(1) : 'Claude');
    const hasToken = !!(o.accessToken && o.accessToken.length > 0);
    const expiresAt = o.expiresAt || 0;
    const authenticated = hasToken && (!expiresAt || expiresAt > Date.now());

    let usage = null;
    if (authenticated) {
      const force = req.query.force === '1';
      if (!force && cache.data && Date.now() - cache.ts < TTL) {
        usage = cache.data;
      } else {
        usage = await fetchUsage(o.accessToken as string);
        if (usage) cache = { ts: Date.now(), data: usage };
      }
    }

    res.json({
      plan,
      authenticated,
      hasToken,
      expiresInMin: expiresAt ? Math.round((expiresAt - Date.now()) / 60000) : null,
      ...(usage || { pct5h: null, pct7d: null, reset5h: null, reset7d: null }),
    });
  } catch (e: any) {
    res.json({ plan: 'Claude', authenticated: false, hasToken: false, pct5h: null, pct7d: null, error: e.message });
  }
});

export default router;
