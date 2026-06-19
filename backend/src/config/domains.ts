// Dominios del portafolio (para alertas de vencimiento). Mantener en sync con
// el frontend src/data/domains.ts. La fecha de expiración = fecha de renovación.

export interface DomainCfg {
  domain: string;
  expiration: string; // YYYY-MM-DD
  registrar: 'namecheap' | 'hostinger' | 'godaddy';
  active: boolean;
}

export const DOMAINS: DomainCfg[] = [
  { domain: 'equilibrioclinic.com.co', expiration: '2026-08-26', registrar: 'hostinger', active: true },
  { domain: 'tenniscartagena.com', expiration: '2026-09-06', registrar: 'namecheap', active: true },
  { domain: 'experienciacartagena.com', expiration: '2026-09-30', registrar: 'namecheap', active: true },
  { domain: 'acbfit.com', expiration: '2026-10-02', registrar: 'godaddy', active: true },
  { domain: 'robertcasanova.com', expiration: '2026-10-12', registrar: 'namecheap', active: true },
  { domain: 'oulet.com', expiration: '2026-10-31', registrar: 'namecheap', active: false },
  { domain: 'motostop.co', expiration: '2026-11-05', registrar: 'namecheap', active: true },
  { domain: 'cobraflow.co', expiration: '2026-12-15', registrar: 'namecheap', active: true },
  { domain: 'santalejandriahotels.com', expiration: '2026-12-15', registrar: 'namecheap', active: true },
  { domain: 'chancletas.co', expiration: '2027-01-22', registrar: 'namecheap', active: true },
  { domain: 'neurocarolina.co', expiration: '2027-02-12', registrar: 'namecheap', active: true },
  { domain: 'dairotraslavina.com', expiration: '2027-04-26', registrar: 'namecheap', active: true },
  { domain: 'dtgrowthpartners.com', expiration: '2027-07-03', registrar: 'namecheap', active: true },
  { domain: 'eloulet.com', expiration: '2029-12-05', registrar: 'namecheap', active: false },
];

export const REGISTRAR_PANEL: Record<DomainCfg['registrar'], string> = {
  namecheap: 'https://ap.www.namecheap.com/domains/list/',
  hostinger: 'https://hpanel.hostinger.com/domains',
  godaddy: 'https://dcc.godaddy.com/control/portfolio',
};

// Umbrales (días antes de vencer) en los que se dispara la alerta. Usar marcas
// exactas evita repetir el aviso todos los días.
export const ALERT_THRESHOLDS = [30, 15, 7, 3, 1];

export const daysUntil = (dateStr: string): number => {
  const target = new Date(`${dateStr}T12:00:00.000Z`).getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};
