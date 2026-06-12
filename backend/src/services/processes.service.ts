import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Procesos cuyo control esta DESHABILITADO desde DTOS por seguridad.
 * - dtos-backend: parar este proceso desde DTOS mata el backend que ejecutaria
 *   el "start" para revivirlo. Restart si esta permitido (pm2 lo revive).
 */
const STOP_PROTECTED = new Set<string>(['dtos-backend']);

export type PM2Status = 'online' | 'stopped' | 'errored' | 'launching' | 'one-launch-status' | 'stopping';

export interface ProcessEntry {
  id: number;
  name: string;
  namespace: string;
  version: string;
  pid: number | null;
  status: PM2Status;
  uptimeMs: number | null;
  restarts: number;
  cpuPct: number;
  memBytes: number;
  user: string;
  mode: 'fork' | 'cluster' | string;
  pmOutLog: string | null;
  pmErrorLog: string | null;
  canStop: boolean;       // false para dtos-backend
  canRestart: boolean;    // true para todos
  canStart: boolean;      // true si esta stopped/errored
}

interface PM2RawEntry {
  pm_id: number;
  name: string;
  pid: number;
  pm2_env: {
    status: PM2Status;
    pm_uptime?: number;
    restart_time?: number;
    namespace?: string;
    version?: string;
    exec_mode?: string;
    username?: string;
    pm_out_log_path?: string;
    pm_err_log_path?: string;
  };
  monit?: {
    cpu?: number;
    memory?: number;
  };
}

const sanitizeName = (name: string): string => {
  // Solo letras, numeros, guiones y guiones bajos. Defensa contra command injection.
  if (!/^[a-zA-Z0-9_\-.]+$/.test(name)) {
    throw Object.assign(new Error(`Nombre de proceso invalido: ${name}`), { status: 400 });
  }
  return name;
};

export const listProcesses = async (): Promise<ProcessEntry[]> => {
  const { stdout } = await execAsync('pm2 jlist', { timeout: 8000, maxBuffer: 5 * 1024 * 1024 });
  let raw: PM2RawEntry[];
  try {
    raw = JSON.parse(stdout);
  } catch (e) {
    throw new Error('pm2 jlist devolvio respuesta no-JSON');
  }
  const now = Date.now();
  return raw.map<ProcessEntry>((p) => {
    const status = p.pm2_env?.status || 'stopped';
    const uptime =
      status === 'online' && p.pm2_env?.pm_uptime
        ? Math.max(0, now - p.pm2_env.pm_uptime)
        : null;
    const isStopped = status === 'stopped' || status === 'errored';
    return {
      id: p.pm_id,
      name: p.name,
      namespace: p.pm2_env?.namespace || 'default',
      version: p.pm2_env?.version || '',
      pid: p.pid || null,
      status,
      uptimeMs: uptime,
      restarts: p.pm2_env?.restart_time ?? 0,
      cpuPct: typeof p.monit?.cpu === 'number' ? p.monit.cpu : 0,
      memBytes: typeof p.monit?.memory === 'number' ? p.monit.memory : 0,
      user: p.pm2_env?.username || 'ubuntu',
      mode: (p.pm2_env?.exec_mode as ProcessEntry['mode']) || 'fork',
      pmOutLog: p.pm2_env?.pm_out_log_path || null,
      pmErrorLog: p.pm2_env?.pm_err_log_path || null,
      canStop: !STOP_PROTECTED.has(p.name) && status === 'online',
      canRestart: status === 'online',
      canStart: isStopped,
    };
  });
};

const findProcess = async (name: string): Promise<ProcessEntry> => {
  sanitizeName(name);
  const list = await listProcesses();
  const p = list.find((x) => x.name === name);
  if (!p) throw Object.assign(new Error(`Proceso ${name} no encontrado`), { status: 404 });
  return p;
};

export type ProcessAction = 'start' | 'stop' | 'restart';

export const actOnProcess = async (
  name: string,
  action: ProcessAction
): Promise<{ name: string; action: ProcessAction; statusAfter: PM2Status }> => {
  sanitizeName(name);

  if (action === 'stop' && STOP_PROTECTED.has(name)) {
    throw Object.assign(
      new Error(`No se puede detener ${name} desde DTOS (esto matarìa el backend). Usa restart en su lugar.`),
      { status: 403 }
    );
  }

  await execAsync(`pm2 ${action} ${name}`, { timeout: 30000 });

  // Esperar un poquito para que pm2 actualice su estado interno
  await new Promise((r) => setTimeout(r, 800));

  const list = await listProcesses();
  const updated = list.find((x) => x.name === name);
  return {
    name,
    action,
    statusAfter: updated?.status || 'stopped',
  };
};

/** Tail de log (out o err) hasta `lines` lineas. */
export const tailProcessLog = async (
  name: string,
  stream: 'out' | 'err',
  lines: number
): Promise<{ name: string; stream: 'out' | 'err'; logPath: string | null; lines: string[] }> => {
  sanitizeName(name);
  const proc = await findProcess(name);
  const logPath = stream === 'out' ? proc.pmOutLog : proc.pmErrorLog;
  if (!logPath) {
    return { name, stream, logPath: null, lines: [] };
  }
  const safeLines = Math.max(10, Math.min(1000, Math.floor(lines || 200)));
  try {
    // Verificamos que el path este dentro de un directorio esperado para evitar
    // que algun atacante explote esto. Los logs PM2 viven bajo ~/.pm2/logs o /var/log.
    const resolved = path.resolve(logPath);
    if (!resolved.includes('.pm2/logs/') && !resolved.startsWith('/var/log/')) {
      throw new Error(`Log path inesperado: ${resolved}`);
    }
    const { stdout } = await execAsync(`tail -n ${safeLines} "${resolved}"`, {
      timeout: 5000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { name, stream, logPath: resolved, lines: stdout.split('\n') };
  } catch (e: any) {
    // Si el archivo no existe, devolver lista vacia en lugar de fallar
    if (e?.code === 'ENOENT' || /No such file/.test(e?.message || '')) {
      return { name, stream, logPath, lines: [] };
    }
    throw e;
  }
};

// Re-export para que el controller no tenga que importar fs/path
export { fs, path };
