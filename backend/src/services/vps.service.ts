import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface VpsHealth {
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: [number, number, number]; // 1, 5, 15 min
  cpu: {
    model: string;
    cores: number;
    usagePct: number; // %
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePct: number;
  };
  disks: {
    mount: string;
    filesystem: string;
    sizeBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePct: number;
  }[];
  network: {
    ifaces: { name: string; ipv4?: string; ipv6?: string }[];
  };
  topProcesses: {
    pid: number;
    user: string;
    cpuPct: number;
    memPct: number;
    command: string;
  }[];
  ts: string;
}

const parseFloatSafe = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** Lee /proc/meminfo y devuelve memoria total/disponible/usada en bytes. */
const readMemInfo = async () => {
  const txt = await fs.readFile('/proc/meminfo', 'utf-8');
  const get = (key: string): number => {
    const m = txt.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'));
    return m ? parseInt(m[1], 10) * 1024 : 0;
  };
  const total = get('MemTotal');
  const available = get('MemAvailable');
  const used = total - available;
  return {
    totalBytes: total,
    availableBytes: available,
    usedBytes: used,
    usagePct: total > 0 ? Math.round((used / total) * 100) : 0,
  };
};

/** Calcula uso de CPU midiendo /proc/stat dos veces con 200ms de gap. */
const readCpuUsage = async (): Promise<number> => {
  const read = async () => {
    const txt = await fs.readFile('/proc/stat', 'utf-8');
    const first = txt.split('\n')[0]; // "cpu user nice system idle iowait irq softirq steal..."
    const parts = first.split(/\s+/).slice(1).map((s) => parseInt(s, 10));
    const idle = parts[3] + (parts[4] || 0); // idle + iowait
    const total = parts.reduce((a, b) => a + (b || 0), 0);
    return { idle, total };
  };
  const a = await read();
  await new Promise((r) => setTimeout(r, 200));
  const b = await read();
  const totalDelta = b.total - a.total;
  const idleDelta = b.idle - a.idle;
  if (totalDelta === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 100)));
};

/** Parsea `df -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay --output=...` */
const readDisks = async () => {
  const { stdout } = await execAsync(
    "df -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay --output=source,target,size,used,avail,pcent 2>/dev/null",
    { timeout: 5000 }
  );
  const lines = stdout.split('\n').slice(1).filter((l) => l.trim());
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      const [fs, target, size, used, avail, pcent] = parts;
      // Filtrar mounts ruidosos del sistema
      if (target.startsWith('/snap/') || target.startsWith('/var/lib/docker/') || target.startsWith('/run/')) {
        return null;
      }
      return {
        filesystem: fs,
        mount: target,
        sizeBytes: parseInt(size, 10) || 0,
        usedBytes: parseInt(used, 10) || 0,
        availableBytes: parseInt(avail, 10) || 0,
        usagePct: parseInt(pcent.replace('%', ''), 10) || 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
};

/** Top N procesos por uso de CPU (combinado con info de mem). */
const readTopProcesses = async (n = 10) => {
  // Usamos ps con sort por %cpu descendente
  const { stdout } = await execAsync(
    `ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu --no-headers | head -n ${n}`,
    { timeout: 5000 }
  );
  return stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) return null;
      const [pid, user, cpu, mem, ...rest] = parts;
      return {
        pid: parseInt(pid, 10),
        user,
        cpuPct: parseFloatSafe(cpu),
        memPct: parseFloatSafe(mem),
        command: rest.join(' '),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
};

/** Lista interfaces de red con sus IPs. */
const readNetwork = () => {
  const ifaces = os.networkInterfaces();
  const result: { name: string; ipv4?: string; ipv6?: string }[] = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    if (name === 'lo') continue;
    const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal)?.address;
    const ipv6 = addrs.find((a) => a.family === 'IPv6' && !a.internal)?.address;
    if (ipv4 || ipv6) result.push({ name, ipv4, ipv6 });
  }
  return result;
};

export const getVpsHealth = async (): Promise<VpsHealth> => {
  const [memInfo, cpuUsage, disks, topProcs] = await Promise.all([
    readMemInfo(),
    readCpuUsage(),
    readDisks().catch(() => []),
    readTopProcesses(10).catch(() => []),
  ]);
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    uptimeSec: Math.floor(os.uptime()),
    loadAvg: [loadAvg[0] || 0, loadAvg[1] || 0, loadAvg[2] || 0],
    cpu: {
      model: cpus[0]?.model || 'unknown',
      cores: cpus.length,
      usagePct: cpuUsage,
    },
    memory: memInfo,
    disks,
    network: { ifaces: readNetwork() },
    topProcesses: topProcs,
    ts: new Date().toISOString(),
  };
};
