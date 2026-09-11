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
  const byId = new Map<string, Set<string>>();
  source.forEach((invoice, index) => {
    if (!invoice.clientId || !nits[index]) return;
    const values = byId.get(invoice.clientId) || new Set<string>();
    values.add(nits[index]);
    byId.set(invoice.clientId, values);
  });
  const groups = new Map<string, { key: string; name: string; nit: string; aliases: string[] }>();
  const invoices = source.map((invoice, index) => {
    const known = invoice.clientId ? byId.get(invoice.clientId) : undefined;
    const nit = nits[index] || (known?.size === 1 ? [...known][0] : '');
    const key = nit ? `nit:${nit}` : invoice.clientId ? `id:${invoice.clientId}` : `invoice:${invoice.id}`;
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
