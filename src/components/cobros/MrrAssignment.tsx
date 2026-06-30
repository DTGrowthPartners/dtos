import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Settings2, Repeat, AlertCircle } from 'lucide-react';
import ClientServicesManager from '@/components/clients/ClientServicesManager';

interface Client { id: string; name: string }
interface CobroRow { clientId: string; monto: number }
interface CobrosResponse { rows?: CobroRow[] }

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Asignar/editar el MRR (servicio recurrente mensual) por cliente. La tabla muestra el
 * MRR actual de cada cliente (derivado de sus servicios recurrentes) y un botón para
 * gestionarlo. Los clientes SIN recurrente aparecen primero, para cuadrar el total.
 */
export default function MrrAssignment() {
  const [clients, setClients] = useState<Client[]>([]);
  const [mrrByClient, setMrrByClient] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMrr = () => {
    apiClient
      .get<CobrosResponse>(`/api/cobros?period=${currentPeriod()}`)
      .then((r) => {
        const m: Record<string, number> = {};
        (r.rows || []).forEach((row) => { m[row.clientId] = (m[row.clientId] || 0) + (row.monto || 0); });
        setMrrByClient(m);
      })
      .catch(() => {});
  };

  useEffect(() => {
    apiClient.get<Client[]>('/api/clients').then(setClients).catch(() => {}).finally(() => setLoading(false));
    loadMrr();
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .map((c) => ({ ...c, mrr: mrrByClient[c.id] || 0 }))
      .sort((a, b) => (a.mrr === 0 ? 0 : 1) - (b.mrr === 0 ? 0 : 1) || b.mrr - a.mrr || a.name.localeCompare(b.name));
  }, [clients, mrrByClient, q]);

  const total = useMemo(() => Object.values(mrrByClient).reduce((a, b) => a + b, 0), [mrrByClient]);
  const conMrr = clients.filter((c) => (mrrByClient[c.id] || 0) > 0).length;
  const sinMrr = clients.length - conMrr;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2"><Repeat className="h-5 w-5 text-primary" /> Asignar MRR por cliente</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Define el servicio recurrente mensual de cada cliente. El total alimenta el MRR del dashboard.</p>
          </div>
          <div className="flex items-center gap-4 text-sm shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">MRR total</p>
              <p className="text-xl font-bold text-primary tabular-nums">{fmt(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Recurrentes</p>
              <p className="text-xl font-bold tabular-nums">{conMrr}<span className="text-sm text-muted-foreground">/{clients.length}</span></p>
            </div>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9" />
        </div>

        {sinMrr > 0 && !q && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> {sinMrr} cliente(s) sin servicio recurrente asignado (aparecen primero).
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Cargando…</div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border max-h-[55vh] overflow-y-auto">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{c.name}</span>
                {c.mrr > 0 ? (
                  <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(c.mrr)}<span className="text-xs text-muted-foreground font-normal">/mes</span></span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">sin recurrente</span>
                )}
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setSelected({ id: c.id, name: c.name })}>
                  <Settings2 className="h-3.5 w-3.5 mr-1" /> {c.mrr > 0 ? 'Editar' : 'Asignar'}
                </Button>
              </div>
            ))}
            {rows.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Sin clientes</div>}
          </div>
        )}
      </CardContent>

      {/* Gestor de servicios del cliente (reutiliza el manager existente) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>MRR · {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && <ClientServicesManager client={selected} onUpdate={loadMrr} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
