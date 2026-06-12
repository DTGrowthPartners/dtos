import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Catálogo de logs disponibles. Whitelist explícito por seguridad — nada de
 * permitir leer paths arbitrarios. Si quieres exponer un log nuevo, agrégalo aquí
 * y haz pm2 restart dtos-backend.
 *
 * Las entradas con baseDir son auto-descubiertas (glob de archivos *.log).
 * Las entradas con path explícito apuntan a un archivo concreto.
 */
interface LogSourceDef {
  id: string;            // identificador estable (URL-safe)
  category: string;      // agrupación para la UI
  label: string;         // nombre legible
  description?: string;
  /** O bien un path absoluto a un archivo, o un baseDir con autodiscovery. */
  path?: string;
  baseDir?: string;
  /** Si baseDir está set, filename pattern. Default: *.log */
  pattern?: string;
}

const SOURCES: LogSourceDef[] = [
  // PM2 logs — todos los procesos. Auto-discovery.
  { id: 'pm2', category: 'PM2', label: 'PM2 (todos los procesos)', baseDir: '/home/ubuntu/.pm2/logs', pattern: '*.log' },

  // Crons del negocio
  { id: 'cron-context-monitor', category: 'Crons', label: 'Context Monitor (Maria)', path: '/tmp/context_monitor.log', description: 'Monitor de contexto cada 10/18 UTC' },
  { id: 'cron-bot-health', category: 'Crons', label: 'Bot Health Monitor', path: '/home/ubuntu/.bot-monitor/cron.log', description: 'Status de bots cada 5 min' },
  { id: 'cron-send-pending', category: 'Crons', label: 'Send Pending (cuentas de cobro)', path: '/home/ubuntu/api-cuentas-de-cobro/send_pending.log', description: 'Envío de cuentas pendientes' },
  { id: 'cron-meta-daily', category: 'Crons', label: 'Meta Daily Report', path: '/home/ubuntu/meta-daily-report/logs/cron.log', description: 'Reporte diario Meta Ads' },
  { id: 'cron-monitor-bloqueos', category: 'Crons', label: 'Monitor Bloqueos Meta', path: '/home/ubuntu/meta-daily-report/logs/monitor-bloqueos.cron.log', description: 'Bloqueos/reactivaciones de cuentas Meta' },
  { id: 'cron-cartera', category: 'Crons', label: 'Cartera Daily Report', path: '/home/ubuntu/cartera-daily-report/logs/cron.log', description: 'Estado de cartera DT-OS' },
  { id: 'cron-beds24-push', category: 'Crons', label: 'Beds24 Push (Directus → Beds24)', path: '/home/ubuntu/beds24-price-sync/push.log', description: 'Sync de precios cada 15 min' },
  { id: 'cron-catalogo-innova', category: 'Crons', label: 'Catálogo Innova', path: '/home/ubuntu/build-catalogo-innova.log', description: 'Refresh catálogo cada 30 min' },
  { id: 'cron-shopify-token', category: 'Crons', label: 'Shopify Token Renew', path: '/home/ubuntu/apps/bot_innova/shopify_token_renew.log', description: 'Renovación de token Shopify' },

  // System
  { id: 'nginx-access', category: 'Sistema', label: 'Nginx access', path: '/var/log/nginx/access.log' },
  { id: 'nginx-error', category: 'Sistema', label: 'Nginx error', path: '/var/log/nginx/error.log' },
  { id: 'auth', category: 'Sistema', label: 'Auth (login attempts)', path: '/var/log/auth.log' },
  { id: 'syslog', category: 'Sistema', label: 'Syslog', path: '/var/log/syslog' },
];

const SAFE_BASE_DIRS = [
  '/home/ubuntu/.pm2/logs',
  '/home/ubuntu/api-cuentas-de-cobro',
  '/home/ubuntu/meta-daily-report/logs',
  '/home/ubuntu/cartera-daily-report/logs',
  '/home/ubuntu/beds24-price-sync',
  '/home/ubuntu/apps/bot_innova',
  '/home/ubuntu/.bot-monitor',
  '/home/ubuntu',
  '/var/log',
  '/tmp',
];

const isSafePath = (p: string): boolean => {
  const resolved = path.resolve(p);
  return SAFE_BASE_DIRS.some((base) => resolved === base || resolved.startsWith(base + '/'));
};

export interface LogSourceItem {
  id: string;
  category: string;
  label: string;
  description?: string;
  path: string;
  exists: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
}

/** Lista todas las fuentes disponibles (incluyendo auto-discovery de PM2 logs). */
export const listLogSources = async (): Promise<LogSourceItem[]> => {
  const items: LogSourceItem[] = [];
  for (const src of SOURCES) {
    if (src.baseDir) {
      // Auto-discovery
      try {
        const files = await fs.readdir(src.baseDir);
        const pattern = src.pattern || '*.log';
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        for (const f of files.filter((x) => regex.test(x))) {
          const full = path.join(src.baseDir, f);
          if (!isSafePath(full)) continue;
          try {
            const stat = await fs.stat(full);
            items.push({
              id: `${src.id}:${f.replace(/[^a-zA-Z0-9_\-.]/g, '_')}`,
              category: src.category,
              label: f,
              description: src.label,
              path: full,
              exists: true,
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
            });
          } catch {
            // skip
          }
        }
      } catch {
        // baseDir no existe
      }
    } else if (src.path) {
      if (!isSafePath(src.path)) continue;
      try {
        const stat = await fs.stat(src.path);
        items.push({
          id: src.id,
          category: src.category,
          label: src.label,
          description: src.description,
          path: src.path,
          exists: true,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        items.push({
          id: src.id,
          category: src.category,
          label: src.label,
          description: src.description,
          path: src.path,
          exists: false,
        });
      }
    }
  }
  return items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
};

/** Busca una fuente por id y devuelve sus datos sanitizados. */
const findSourceById = async (id: string): Promise<LogSourceItem | undefined> => {
  const all = await listLogSources();
  return all.find((s) => s.id === id);
};

export interface LogTailResult {
  id: string;
  path: string;
  lines: string[];
  truncated: boolean;
}

/** Lee las últimas N líneas de un log (cap a 1000) con `tail`. */
export const tailLog = async (
  id: string,
  lines: number,
  grep?: string
): Promise<LogTailResult> => {
  const src = await findSourceById(id);
  if (!src) throw Object.assign(new Error(`Log ${id} no encontrado en el whitelist`), { status: 404 });
  if (!src.exists) {
    return { id, path: src.path, lines: [], truncated: false };
  }
  if (!isSafePath(src.path)) throw Object.assign(new Error('Path fuera del whitelist de directorios seguros'), { status: 403 });

  const cappedLines = Math.max(10, Math.min(2000, Math.floor(lines || 200)));

  // Si hay grep, usamos un buffer mayor para que el grep tenga texto donde buscar.
  // Validación: solo letras/números/espacios/algunos símbolos comunes — sin shell injection.
  let cmd: string;
  if (grep && /^[A-Za-z0-9 _\-:./]{1,80}$/.test(grep)) {
    // Buscar en el archivo completo, devolver últimas N líneas que matchean
    cmd = `grep -F -- "${grep}" "${src.path}" | tail -n ${cappedLines}`;
  } else {
    cmd = `tail -n ${cappedLines} "${src.path}"`;
  }

  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000, maxBuffer: 10 * 1024 * 1024 });
    const rows = stdout.split('\n');
    // Quitar última fila vacía si hay
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    return {
      id,
      path: src.path,
      lines: rows,
      truncated: false,
    };
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return { id, path: src.path, lines: [], truncated: false };
    }
    throw e;
  }
};
