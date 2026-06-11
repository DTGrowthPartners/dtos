import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CronEntry {
  id: string;
  source: 'user' | 'system' | 'cron.d' | 'systemd';
  sourceLabel: string;
  schedule: string;          // raw cron expression o "OnCalendar=..." para systemd
  scheduleHuman: string;     // version legible mejor esfuerzo
  command: string;
  user?: string;
  description?: string;      // extraido del comentario inmediatamente arriba
  enabled: boolean;
  nextRun?: string;          // solo systemd timers
  lastRun?: string;          // solo systemd timers
}

/** Humaniza expresiones cron comunes a frases en español. */
const humanizeCron = (expr: string): string => {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  const everyN = (s: string) => {
    const m = s.match(/^\*\/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  // Cada N min: */5 * * * *
  if (everyN(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Cada ${everyN(min)} min`;
  }
  // Cada minuto
  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return 'Cada minuto';
  }
  // Cada N horas: 0 */2 * * *
  if (min === '0' && everyN(hour) && dom === '*' && mon === '*' && dow === '*') {
    return `Cada ${everyN(hour)} h`;
  }
  // Diario a hora especifica: 55 12 * * *
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    const h = hour.padStart(2, '0');
    const m = min.padStart(2, '0');
    return `Diario a las ${h}:${m} UTC`;
  }
  // Semanal: 0 5 * * 0
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && /^\d+$/.test(dow)) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `Semanal ${dias[parseInt(dow, 10)] || dow} ${hour}:${min.padStart(2, '0')} UTC`;
  }
  // Mensual día 1
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    return `Día ${dom} del mes a las ${hour}:${min.padStart(2, '0')} UTC`;
  }
  // Rango con step: 2-59/5 * * * *
  const rangeStep = min.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (rangeStep && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Cada ${rangeStep[3]} min (offset ${rangeStep[1]})`;
  }

  return expr;
};

/** Parsea un crontab del estilo "user" (5 campos + comando). */
const parseUserCrontab = (text: string, source: CronEntry['source'], sourceLabel: string): CronEntry[] => {
  const out: CronEntry[] = [];
  const lines = text.split('\n');
  let pendingComment = '';
  let idx = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingComment = '';
      continue;
    }
    if (line.startsWith('#')) {
      const stripped = line.replace(/^#+\s*/, '').trim();
      // Detectar lineas comentadas con cron (deshabilitadas)
      const cronMatch = stripped.match(/^(\*|[\d,\-*/]+)\s+(\*|[\d,\-*/]+)\s+(\*|[\d,\-*/]+)\s+(\*|[\d,\-*/]+)\s+(\*|[\d,\-*/]+)\s+(.+)$/);
      if (cronMatch) {
        out.push({
          id: `${source}-${idx++}`,
          source,
          sourceLabel,
          schedule: `${cronMatch[1]} ${cronMatch[2]} ${cronMatch[3]} ${cronMatch[4]} ${cronMatch[5]}`,
          scheduleHuman: humanizeCron(`${cronMatch[1]} ${cronMatch[2]} ${cronMatch[3]} ${cronMatch[4]} ${cronMatch[5]}`),
          command: cronMatch[6],
          description: pendingComment || '(deshabilitado)',
          enabled: false,
        });
        pendingComment = '';
        continue;
      }
      pendingComment = stripped;
      continue;
    }
    // Linea de cron activa
    const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) {
      pendingComment = '';
      continue;
    }
    const schedule = `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
    out.push({
      id: `${source}-${idx++}`,
      source,
      sourceLabel,
      schedule,
      scheduleHuman: humanizeCron(schedule),
      command: m[6],
      description: pendingComment || undefined,
      enabled: true,
    });
    pendingComment = '';
  }
  return out;
};

/** Parsea /etc/cron.d/* (formato system: 5 campos + user + comando) */
const parseSystemCrontab = (text: string, source: CronEntry['source'], sourceLabel: string): CronEntry[] => {
  const out: CronEntry[] = [];
  const lines = text.split('\n');
  let pendingComment = '';
  let idx = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pendingComment = '';
      continue;
    }
    if (line.startsWith('#')) {
      pendingComment = line.replace(/^#+\s*/, '').trim();
      continue;
    }
    // Saltar declaraciones de env (SHELL=, PATH=)
    if (/^[A-Z_]+=/.test(line)) continue;
    const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const schedule = `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
    out.push({
      id: `${source}-${idx++}-${sourceLabel}`,
      source,
      sourceLabel,
      schedule,
      scheduleHuman: humanizeCron(schedule),
      command: m[7],
      user: m[6],
      description: pendingComment || undefined,
      enabled: true,
    });
    pendingComment = '';
  }
  return out;
};

export const listAllCrons = async (): Promise<CronEntry[]> => {
  const all: CronEntry[] = [];

  // 1) crontab -l del usuario que corre el backend (ubuntu)
  try {
    const { stdout } = await execAsync('crontab -l', { timeout: 5000 });
    all.push(...parseUserCrontab(stdout, 'user', 'Crontab de ubuntu'));
  } catch {
    // Sin crontab o crontab no instalado — ignorar
  }

  // 2) /etc/crontab
  try {
    const text = await fs.readFile('/etc/crontab', 'utf-8');
    all.push(...parseSystemCrontab(text, 'system', '/etc/crontab'));
  } catch {
    // ignore
  }

  // 3) /etc/cron.d/*
  try {
    const files = await fs.readdir('/etc/cron.d');
    for (const f of files) {
      const full = path.join('/etc/cron.d', f);
      try {
        const text = await fs.readFile(full, 'utf-8');
        all.push(...parseSystemCrontab(text, 'cron.d', `/etc/cron.d/${f}`));
      } catch {
        // ignore (permisos, etc.)
      }
    }
  } catch {
    // ignore
  }

  // 4) systemd timers — parser robusto basado en regex (la salida de `list-timers`
  // mezcla espacios simples dentro de las fechas con multiples espacios entre columnas,
  // asi que no podemos confiar en split por whitespace).
  try {
    const { stdout } = await execAsync('systemctl list-timers --all --no-pager --no-legend 2>/dev/null', { timeout: 10000 });
    const lines = stdout.split('\n');
    let idx = 0;
    const dayRegex = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\S+/g;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Buscar "<unidad>.timer  <activates>" al final de la linea.
      const tail = trimmed.match(/(\S+\.timer)\s+(\S+)\s*$/);
      if (!tail) continue;
      const unit = tail[1];
      const activates = tail[2];
      // Extraer fechas (NEXT, LAST) si las hay. "-" o "n/a" significa que el timer aun no ha corrido.
      const before = trimmed.slice(0, trimmed.indexOf(unit));
      const dateMatches = [...before.matchAll(dayRegex)].map((m) => m[0]);
      const nextRun = dateMatches[0];
      const lastRun = dateMatches[1];
      const enabled = !!nextRun && !nextRun.startsWith('-');
      all.push({
        id: `systemd-${idx++}-${unit}`,
        source: 'systemd',
        sourceLabel: `systemd: ${unit}`,
        schedule: 'systemd timer',
        scheduleHuman: '—',
        command: activates || unit.replace('.timer', '.service'),
        enabled,
        nextRun,
        lastRun,
      });
    }
  } catch {
    // ignore
  }

  return all;
};
