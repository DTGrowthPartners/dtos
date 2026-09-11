import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { authService } from '@/lib/auth';
import { filterDocuments, type SearchDocument } from '@/lib/document-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const money = (value: number) => Number(value || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
export default function BuscarDocumentos() {
  const [rows, setRows] = useState<SearchDocument[]>([]);
  const [client, setClient] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await apiClient.get<SearchDocument[]>('/api/invoices')); setPage(1); }
    catch { setError('No se pudieron cargar los documentos. Intenta actualizar.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const results = useMemo(() => filterDocuments(rows, client, number, type), [rows, client, number, type]);
  const pages = Math.max(1, Math.ceil(results.length / 25));
  const visible = results.slice((page - 1) * 25, page * 25);
  async function download(row: SearchDocument) {
    setDownloading(row.id);
    try {
      let token = await authService.getToken();
      const request = () => fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/invoices/${encodeURIComponent(row.id)}/download`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      let response = await request();
      if (response.status === 401) { token = await authService.refreshToken(); response = await request(); }
      if (!response.ok) throw new Error('download');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `${row.factusNumber || row.invoiceNumber}.pdf`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { toast({ title: 'No se pudo descargar el PDF', description: 'Actualiza la página e inténtalo nuevamente.', variant: 'destructive' }); }
    finally { setDownloading(null); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Search className="h-6 w-6" />Buscar documentos</h1><p className="text-muted-foreground">Consulta cuentas de cobro y facturas electrónicas de todos los estados.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button></div>
    <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-3">
      <div className="space-y-2"><Label htmlFor="document-client">Cliente: nombre o NIT</Label><Input id="document-client" placeholder="Escribe el nombre o NIT" value={client} onChange={e => { setClient(e.target.value); setPage(1); }} /></div>
      <div className="space-y-2"><Label htmlFor="document-number">Número de cuenta o factura</Label><Input id="document-number" placeholder="Número completo o una parte" value={number} onChange={e => { setNumber(e.target.value); setPage(1); }} /></div>
      <div className="space-y-2"><Label htmlFor="document-type">Tipo de documento</Label><select id="document-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Todos los documentos</option><option value="cuenta_cobro">Cuentas de cobro</option><option value="factura_electronica">Facturas electrónicas</option></select></div>
      <div className="md:col-span-3 flex items-center justify-between"><span className="text-sm text-muted-foreground" aria-live="polite">{loading ? 'Cargando documentos…' : `${results.length} documentos encontrados`}</span><Button variant="ghost" onClick={() => { setClient(''); setNumber(''); setType(''); setPage(1); }}>Limpiar filtros</Button></div>
    </CardContent></Card>
    {error ? <p role="alert" className="text-destructive">{error}</p> : !loading && <Card><Table><TableHeader><TableRow>{['Documento', 'Cliente', 'Fecha', 'Descripción', 'Valor', 'Abonado', 'Saldo', 'Estado', 'PDF'].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>
      {visible.map(row => <TableRow key={row.id}>
        <TableCell><p className="font-medium">{row.factusNumber || row.invoiceNumber}</p><p className="text-xs text-muted-foreground">{row.tipoDocumento === 'factura_electronica' ? 'Factura electrónica' : 'Cuenta de cobro'}</p>{row.factusNumber && <p className="text-xs">N.º interno: {row.invoiceNumber}</p>}</TableCell>
        <TableCell><p>{row.clientName}</p><p className="text-xs text-muted-foreground">{row.clientNit || 'Sin NIT registrado'}</p></TableCell>
        <TableCell className="whitespace-nowrap">{row.fecha?.slice(0, 10)}</TableCell><TableCell className="min-w-48 max-w-sm whitespace-normal">{row.concepto || row.servicio || 'Sin descripción registrada'}</TableCell>
        <TableCell className="whitespace-nowrap">{money(row.totalAmount)}</TableCell><TableCell className="whitespace-nowrap">{money(row.paidAmount || 0)}</TableCell><TableCell className="whitespace-nowrap font-semibold">{money(Math.max(0, Number(row.totalAmount) - Number(row.paidAmount || 0)))}</TableCell><TableCell className="capitalize">{row.status}</TableCell>
        <TableCell><Button size="sm" variant="outline" disabled={downloading !== null} onClick={() => download(row)} aria-label={`Descargar PDF ${row.invoiceNumber}`}><Download className="h-4 w-4 mr-1" />{downloading === row.id ? 'Descargando…' : 'PDF'}</Button></TableCell>
      </TableRow>)}
      {!visible.length && <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No se encontraron documentos con esos filtros.</TableCell></TableRow>}
    </TableBody></Table><div className="flex items-center justify-end gap-3 p-4"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm">Página {page} de {pages}</span><Button variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button></div></Card>}
  </div>;
}
