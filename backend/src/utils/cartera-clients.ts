interface ClientInvoice {
  id: string;
  clientId?: string;
  clientName?: string;
  clientNit?: string;
}

export const normalizeClientSearch = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseNit(value = '') {
  const cleaned = String(value).trim().replace(/^nit\s*[:.]?\s*/i, '');
  if (!/^[\d.\s,\-–—]+$/.test(cleaned)) return { base: '', full: '' };
  const explicit = cleaned.match(/^([\d.\s,]+)\s*[-–—]\s*(\d)$/);
  const full = cleaned.replace(/\D/g, '');
  if (/^0+$/.test(full)) return { base: '', full: '' };
  return { base: explicit ? explicit[1].replace(/\D/g, '') : full, full };
}

export function groupCarteraClients<T extends ClientInvoice>(source: T[]) {
  // An explicit DV also identifies its compact spelling, without truncating
  // unrelated document numbers just because they have a common prefix.
  const aliases = new Map<string, Set<string>>();
  source.forEach((invoice) => {
    const { base, full } = parseNit(invoice.clientNit);
    if (base && base !== full) {
      const bases = aliases.get(full) || new Set<string>();
      bases.add(base);
      aliases.set(full, bases);
    }
  });
  const nits = source.map((invoice) => {
    const { base, full } = parseNit(invoice.clientNit);
    const bases = aliases.get(full);
    const normalized = base === full && bases?.size === 1 ? [...bases][0] : base;
    // Preserve the documented Caribe Fest correction from the existing report.
    return normalized === '9018834468' ? '901883468' : normalized;
  });
  const byId = new Map<string, Map<string, number>>();
  source.forEach((invoice, index) => {
    if (!invoice.clientId || !nits[index]) return;
    const values = byId.get(invoice.clientId) || new Map<string, number>();
    values.set(nits[index], (values.get(nits[index]) || 0) + 1);
    byId.set(invoice.clientId, values);
  });
  // A stable client ID links historical names and mistyped NITs. Use its most
  // frequent NIT for display, without modifying the original invoice data.
  const canonicalById = new Map([...byId].map(([id, counts]) => [id,
    [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
  ]));
  const nameKey = (name: string) => normalizeClientSearch(name.replace(/\bS\.?\s*A\.?\s*S\.?\s*$/i, ''));
  const knownByName = new Map<string, Set<string>>();
  const knownByNit = new Map<string, Set<string>>();
  const initialKeys = source.map((invoice, index) => {
    const nit = (invoice.clientId && canonicalById.get(invoice.clientId)) || nits[index];
    return nit ? `nit:${nit}` : invoice.clientId ? `id:${invoice.clientId}` : '';
  });
  source.forEach((invoice, index) => {
    const key = initialKeys[index];
    if (!key) return;
    for (const [map, value] of [[knownByName, nameKey(invoice.clientName || '')], [knownByNit, nits[index]]] as const) {
      if (!value) continue;
      const keys = map.get(value) || new Set<string>();
      keys.add(key);
      map.set(value, keys);
    }
  });
  const unique = (keys?: Set<string>) => keys?.size === 1 ? [...keys][0] : '';
  const groups = new Map<string, { key: string; name: string; nit: string; aliases: string[] }>();
  const invoices = source.map((invoice, index) => {
    const normalizedName = nameKey(invoice.clientName || '');
    const key = invoice.clientId ? initialKeys[index]
      : unique(knownByNit.get(nits[index])) || initialKeys[index]
        || unique(knownByName.get(normalizedName)) || (normalizedName ? `name:${normalizedName}` : `invoice:${invoice.id}`);
    const nit = key.startsWith('nit:') ? key.slice(4) : '';
    const name = invoice.clientName?.trim() || nit || 'Sin nombre';
    let group = groups.get(key);
    if (!group) {
      group = { key, name, nit, aliases: [] };
      groups.set(key, group);
    }
    if (name.localeCompare(group.name, 'es') < 0) group.name = name;
    group.aliases.push(name, invoice.clientNit || '');
    return { ...invoice, clientKey: key, canonicalNit: nit };
  });
  return { invoices, clients: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.key.localeCompare(b.key)) };
}

export function matchesCarteraClient(client: { name: string; nit: string; aliases: string[] }, query: string) {
  const haystack = normalizeClientSearch([client.name, client.nit, ...client.aliases].join(' '));
  return query.trim().split(/\s+/).map(normalizeClientSearch).filter(Boolean)
    .every((term) => haystack.includes(term));
}

// Paid status takes precedence over stale payment totals in imported documents.
export function isPendingCarteraInvoice(invoice: {
  status: string; factusStatus?: string | null; totalAmount: number; paidAmount?: number | null;
}) {
  return invoice.status !== 'pagada' && invoice.factusStatus !== 'anulada'
    && Math.round((invoice.totalAmount - (invoice.paidAmount || 0)) * 100) / 100 > 0;
}
