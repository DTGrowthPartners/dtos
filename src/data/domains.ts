// Catálogo de dominios y webs de DT Growth Partners.
// La fecha de expiración es también la fecha de renovación (el día en que se paga
// el dominio). La renovación la paga el CLIENTE. Precio anual placeholder: 600.000 COP.

export type WebPlatform = 'shopify' | 'wordpress' | 'react' | 'inactivo';
export type Registrar = 'namecheap' | 'hostinger' | 'godaddy';

export interface DomainEntry {
  domain: string;
  /** Fecha de expiración = fecha de renovación/pago (YYYY-MM-DD). */
  expiration: string;
  platform: WebPlatform;
  registrar: Registrar;
  /** Costo de renovación anual en COP (placeholder). */
  annualPrice: number;
  /** Quién paga la renovación. */
  paidBy: 'cliente' | 'dtgp';
}

// URL del panel para administrar el dominio según el registrador.
export const REGISTRAR_URL: Record<Registrar, string> = {
  namecheap: 'https://ap.www.namecheap.com/domains/list/',
  hostinger: 'https://hpanel.hostinger.com/domains?_ga=GA1.1.1419409484.1781041617',
  godaddy: 'https://dcc.godaddy.com/control/portfolio',
};

export const REGISTRAR_LABEL: Record<Registrar, string> = {
  namecheap: 'Namecheap',
  hostinger: 'Hostinger',
  godaddy: 'GoDaddy',
};

export const PLATFORM_LABEL: Record<WebPlatform, string> = {
  shopify: 'Shopify',
  wordpress: 'WordPress',
  react: 'React',
  inactivo: 'Inactivo',
};

// Clases de color para la insignia de plataforma.
export const PLATFORM_BADGE: Record<WebPlatform, string> = {
  shopify: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  wordpress: 'border-blue-500/40 bg-blue-500/10 text-blue-500',
  react: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-500',
  inactivo: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

const DEFAULT_PRICE = 600000;

export const DOMAINS: DomainEntry[] = [
  { domain: 'tenniscartagena.com',        expiration: '2026-09-06', platform: 'shopify',   registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'experienciacartagena.com',   expiration: '2026-09-30', platform: 'wordpress', registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'robertcasanova.com',         expiration: '2026-10-12', platform: 'wordpress', registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'oulet.com',                  expiration: '2026-10-31', platform: 'inactivo',  registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'motostop.co',                expiration: '2026-11-05', platform: 'shopify',   registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'cobraflow.co',               expiration: '2026-12-15', platform: 'react',     registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'santalejandriahotels.com',   expiration: '2026-12-15', platform: 'react',     registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'chancletas.co',              expiration: '2027-01-22', platform: 'shopify',   registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'neurocarolina.co',           expiration: '2027-02-12', platform: 'react',     registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'dairotraslavina.com',        expiration: '2027-04-26', platform: 'react',     registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'dtgrowthpartners.com',       expiration: '2027-07-03', platform: 'react',     registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'eloulet.com',                expiration: '2029-12-05', platform: 'inactivo',  registrar: 'namecheap', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'equilibrioclinic.com.co',    expiration: '2026-08-26', platform: 'react',     registrar: 'hostinger', annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
  { domain: 'acbfit.com',                 expiration: '2026-10-02', platform: 'wordpress', registrar: 'godaddy',   annualPrice: DEFAULT_PRICE, paidBy: 'cliente' },
];

/** Días desde hoy hasta la fecha dada (negativo si ya pasó). */
export const daysUntil = (dateStr: string): number => {
  const target = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
};

export type DomainStatus = 'vencido' | 'por-vencer' | 'vigente' | 'inactivo';

export const domainStatus = (d: DomainEntry): DomainStatus => {
  if (d.platform === 'inactivo') return 'inactivo';
  const days = daysUntil(d.expiration);
  if (days < 0) return 'vencido';
  if (days <= 30) return 'por-vencer';
  return 'vigente';
};

export const formatDomainDate = (dateStr: string): string =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatCOP = (n: number): string => `$${Math.round(n).toLocaleString('es-CO')}`;
