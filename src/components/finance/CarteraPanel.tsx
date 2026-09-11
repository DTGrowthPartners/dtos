import { invoiceDescription, invoicePayments, type InvoiceExportSource } from '@/lib/cartera-document-data';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Mail } from 'lucide-react';
import { Wallet, AlertCircle, FileDown, FileSpreadsheet, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { isPendingCarteraInvoice, groupCarteraClients, matchesCarteraClient } from '@/lib/cartera-clients';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface InvoiceLite extends InvoiceExportSource {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  paidAmount: number;
  fecha: string;
  status: string;
  tipoDocumento?: string;
  factusStatus?: string | null;
}

const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO');

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  parcial: { label: 'Parcial', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  enviada: { label: 'Enviada', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  pagada: { label: 'Pagada', cls: 'bg-green-100 text-green-800 border-green-200' },
};

const TIPO_DOC_LABELS: Record<string, string> = {
  cuenta_cobro: 'Cuenta de Cobro',
  factura_electronica: 'Factura Electrónica',
};

const diasDesde = (fecha: string) => Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000));

type Bucket = 'corriente' | 'd31_60' | 'd61_90' | 'd90_mas';
const BUCKET_LABEL: Record<Bucket, string> = {
  corriente: '0-30 días',
  d31_60: '31-60 días',
  d61_90: '61-90 días',
  d90_mas: '+90 días',
};
const BUCKET_CLASS: Record<Bucket, string> = {
  corriente: 'bg-green-100 text-green-700 border-green-200',
  d31_60: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  d61_90: 'bg-orange-100 text-orange-700 border-orange-200',
  d90_mas: 'bg-red-100 text-red-700 border-red-200',
};
const bucketFor = (dias: number): Bucket => (dias <= 30 ? 'corriente' : dias <= 60 ? 'd31_60' : dias <= 90 ? 'd61_90' : 'd90_mas');

export default function CarteraPanel() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string | null>(null); // null = vista general
  const [clientQuery, setClientQuery] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const [sendingEmail, setSendingEmail] = useState(false);
  const emailInFlight = useRef(false);

  const sendCarteraEmail = async () => {
    if (emailInFlight.current) return;
    emailInFlight.current = true;
    setSendingEmail(true);
    try {
      await apiClient.post('/api/invoices/cartera/send-email');
      toast({ title: 'Correo enviado', description: 'Cartera completa enviada a Dairotras@gmail.com y jhonpm07@gmail.com.' });
    } catch (error) {
      toast({ title: 'Error al enviar', description: error instanceof Error ? error.message : 'No se pudo confirmar el envío del correo.', variant: 'destructive' });
    } finally {
      emailInFlight.current = false;
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.get<InvoiceLite[]>('/api/invoices');
        setInvoices(data);
      } catch {
        toast({ title: 'Error', description: 'No se pudo cargar la información de cartera.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { invoices: groupedInvoices, clients } = useMemo(() => {
    const grouped = groupCarteraClients(invoices.filter((invoice) => invoice.factusStatus !== 'anulada'));
    const pending = grouped.invoices.filter(isPendingCarteraInvoice);
    const keys = new Set(pending.map((invoice) => invoice.clientKey));
    return { invoices: pending, clients: grouped.clients.filter((client) => keys.has(client.key)) };
  }, [invoices]);
  const selectedClientInfo = clients.find((client) => client.key === selectedClient);
  const filteredClients = useMemo(() => clients.filter((client) => matchesCarteraClient(client, clientQuery)), [clients, clientQuery]);

  // Solo lo pendiente (saldo > 0), para la vista general y la antigüedad de cartera.
  const pendientes = useMemo(
    () => groupedInvoices
      .map((inv) => ({ ...inv, saldo: Math.round((inv.totalAmount - (inv.paidAmount || 0)) * 100) / 100 }))
      .filter((inv) => inv.saldo > 0),
    [groupedInvoices]
  );

  const carteraPorCliente = useMemo(() => {
    const map = new Map<string, { nit: string; total: number; count: number; oldest: string }>();
    pendientes.forEach((inv) => {
      const cur = map.get(inv.clientKey) || { nit: inv.canonicalNit, total: 0, count: 0, oldest: inv.fecha };
      cur.total += inv.saldo;
      cur.count += 1;
      if (new Date(inv.fecha) < new Date(cur.oldest)) cur.oldest = inv.fecha;
      map.set(inv.clientKey, cur);
    });
    return Array.from(map.entries())
      .map(([key, v]) => {
        const clientName = clients.find((client) => client.key === key)?.name || key;
        const dias = diasDesde(v.oldest);
        return { key, clientName, nit: v.nit, saldo: Math.round(v.total * 100) / 100, count: v.count, dias, bucket: bucketFor(dias) };
      })
      .sort((a, b) => b.saldo - a.saldo);
  }, [pendientes, clients]);

  const totalCartera = useMemo(() => pendientes.reduce((s, inv) => s + inv.saldo, 0), [pendientes]);

  const bucketTotals = useMemo(() => {
    const totals: Record<Bucket, number> = { corriente: 0, d31_60: 0, d61_90: 0, d90_mas: 0 };
    pendientes.forEach((inv) => { totals[bucketFor(diasDesde(inv.fecha))] += inv.saldo; });
    return totals;
  }, [pendientes]);

  // Vista por cliente: solo documentos pendientes de pago.
  const facturasCliente = useMemo(() => {
    if (!selectedClient) return [];
    return groupedInvoices
      .filter((inv) => inv.clientKey === selectedClient)
      .map((inv) => ({ ...inv, saldo: Math.round((inv.totalAmount - (inv.paidAmount || 0)) * 100) / 100 }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [groupedInvoices, selectedClient]);

  const clienteTotales = useMemo(() => ({
    facturado: facturasCliente.reduce((s, f) => s + f.totalAmount, 0),
    pagado: facturasCliente.reduce((s, f) => s + (f.paidAmount || 0), 0),
    saldo: facturasCliente.reduce((s, f) => s + f.saldo, 0),
  }), [facturasCliente]);

  const periodLabel = fmtDate(new Date().toISOString());

  const handleExport = async (formato: 'pdf' | 'excel') => {
    setExporting(formato);
    try {
      const mod = await import('@/lib/finance-exports');
      const exportRows = (selectedClient ? facturasCliente : pendientes).map((f) => ({
        invoiceNumber: f.invoiceNumber,
        clientName: clients.find((client) => client.key === f.clientKey)?.name || f.clientName,
        clientNit: f.canonicalNit,
        description: invoiceDescription(f),
        payments: invoicePayments(f, fmtDate),
        tipoDocumento: TIPO_DOC_LABELS[f.tipoDocumento || 'cuenta_cobro'] || f.tipoDocumento || '',
        fecha: fmtDate(f.fecha), totalAmount: f.totalAmount, paidAmount: f.paidAmount || 0,
        saldo: f.saldo, statusLabel: STATUS_LABELS[f.status]?.label || f.status,
      }));
      if (!selectedClient) {
        const payload = {
          vista: 'general' as const,
          periodLabel,
          totalCartera,
          facturas: exportRows,
          clientes: carteraPorCliente.map((c) => ({
            clientName: c.clientName, nit: c.nit, facturas: c.count, saldo: c.saldo,
            diasAntiguedad: c.dias, bucketLabel: BUCKET_LABEL[c.bucket],
          })),
          bucketTotals: (Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => ({ label: BUCKET_LABEL[b], total: bucketTotals[b] })),
        };
        if (formato === 'pdf') await mod.exportCarteraPDF(payload); else await mod.exportCarteraExcel(payload);
      } else {
        const payload = {
          vista: 'cliente' as const,
          periodLabel,
          clientName: selectedClientInfo?.name || '',
          clientNit: selectedClientInfo?.nit || '',
          facturas: exportRows,
          totalFacturado: clienteTotales.facturado,
          totalPagado: clienteTotales.pagado,
          totalSaldo: clienteTotales.saldo,
        };
        if (formato === 'pdf') await mod.exportCarteraPDF(payload); else await mod.exportCarteraExcel(payload);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el archivo.', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando cartera...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Cartera
          </h2>
          <p className="text-sm text-muted-foreground">Estado de cartera por cliente y general — corte al {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={sendCarteraEmail} disabled={sendingEmail}
            title="Envía toda la cartera pendiente a Dairotras@gmail.com y jhonpm07@gmail.com, sin aplicar los filtros de esta vista">
            {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            {sendingEmail ? 'Enviando...' : 'Enviar cartera completa'}
          </Button>

          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={exporting !== null}>
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-4">
        <div className="space-y-2">
          <label htmlFor="cartera-search" className="text-sm font-medium">Buscar cliente por nombre o NIT</label>
          <Input id="cartera-search" placeholder="Escribe el nombre o NIT..." value={clientQuery}
            onChange={(event) => setClientQuery(event.target.value)} />
        </div>
        <div className="space-y-2">
          <label htmlFor="cartera-client" className="text-sm font-medium">Cliente</label>
          <select id="cartera-client" aria-label="Cliente" value={selectedClient || ''}
            onChange={(event) => { setSelectedClient(event.target.value || null); setClientQuery(''); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos los clientes con saldo pendiente</option>
            {selectedClientInfo && !filteredClients.some((client) => client.key === selectedClient) && (
              <option value={selectedClientInfo.key}>{selectedClientInfo.name} (seleccionado)</option>
            )}
            {filteredClients.map((client) => (
              <option key={client.key} value={client.key}>{client.name}{client.nit ? ` - ${client.nit}` : ''}</option>
            ))}
          </select>
          {filteredClients.length === 0 && <p role="status" className="text-sm text-muted-foreground">No hay clientes con saldo pendiente que coincidan.</p>}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">El PDF incluye solo documentos pendientes y parciales del cliente seleccionado, con su saldo por pagar.</p>
      </div>

      {!selectedClient ? (
        <>
          {/* Resumen general */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Cartera</p>
              <p className="text-2xl font-bold text-foreground">{fmt(totalCartera)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Clientes con Cartera</p>
              <p className="text-2xl font-bold text-foreground">{carteraPorCliente.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
              <p className="text-2xl font-bold text-foreground">{pendientes.length}</p>
            </CardContent></Card>
          </div>

          {/* Antigüedad de cartera */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5"><AlertCircle className="h-4 w-4 text-warning" /> Antigüedad de Cartera</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
                  <div key={b} className={cn('rounded-lg border p-3', BUCKET_CLASS[b])}>
                    <p className="text-xs font-medium">{BUCKET_LABEL[b]}</p>
                    <p className="text-lg font-bold mt-0.5">{fmt(bucketTotals[b])}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabla por cliente */}
          <Card>
            <CardContent className="p-0">
              {carteraPorCliente.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">No hay cartera pendiente.</div>
              ) : (
                <div className="table-responsive">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>NIT</TableHead>
                        <TableHead className="text-center">Facturas</TableHead>
                        <TableHead>Antigüedad</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carteraPorCliente.map((c) => (
                        <TableRow key={c.key}>
                          <TableCell className="font-medium break-words">{c.clientName}</TableCell>
                          <TableCell className="whitespace-nowrap">{c.nit || '—'}</TableCell>
                          <TableCell className="text-center">{c.count}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('whitespace-nowrap', BUCKET_CLASS[c.bucket])}>{BUCKET_LABEL[c.bucket]}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">{fmt(c.saldo)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedClient(c.key)}>Ver estado</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Resumen por cliente */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Facturado</p>
              <p className="text-2xl font-bold text-foreground">{fmt(clienteTotales.facturado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Abonado</p>
              <p className="text-2xl font-bold text-foreground">{fmt(clienteTotales.pagado)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
              <p className={cn('text-2xl font-bold', clienteTotales.saldo > 0.5 ? 'text-warning' : 'text-success')}>{fmt(clienteTotales.saldo)}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {facturasCliente.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Este cliente no tiene facturas registradas.</div>
              ) : (
                <div className="table-responsive">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Documento</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Abonado</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturasCliente.map((f) => {
                        const st = STATUS_LABELS[f.status] || { label: f.status, cls: 'bg-gray-100 text-gray-700 border-gray-200' };
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium break-words">#{f.invoiceNumber.substring(0, 14)}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{TIPO_DOC_LABELS[f.tipoDocumento || 'cuenta_cobro'] || f.tipoDocumento}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtDate(f.fecha)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmt(f.totalAmount)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmt(f.paidAmount || 0)}</TableCell>
                            <TableCell className={cn('text-right whitespace-nowrap font-semibold', f.saldo > 0.5 ? 'text-warning' : 'text-muted-foreground')}>{fmt(f.saldo)}</TableCell>
                            <TableCell><Badge variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
