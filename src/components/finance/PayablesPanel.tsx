import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, RefreshCcw, FileWarning, Wallet, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface PayablePayment {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod?: string;
  reference?: string;
}

interface Payable {
  id: string;
  supplierName: string;
  concept: string;
  category?: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  status: string;
  notes?: string;
  payments: PayablePayment[];
}

interface Summary {
  totalFacturado: number;
  totalPagado: number;
  saldoPorPagar: number;
  vencidas: number;
  count: number;
}

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');

const CATEGORIES = ['servicios', 'software', 'arriendo', 'impuestos', 'nómina', 'marketing', 'otros'];

const STATUS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  parcial: { label: 'Parcial', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  pagado: { label: 'Pagado', cls: 'bg-green-100 text-green-700 border-green-200' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const isOverdue = (p: Payable) => p.status !== 'pagado' && p.status !== 'cancelado' && !!p.dueDate && new Date(p.dueDate) < new Date();

const emptyForm = { supplierName: '', concept: '', category: 'servicios', totalAmount: '', issueDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '' };

export default function PayablesPanel() {
  const { toast } = useToast();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [payFor, setPayFor] = useState<Payable | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paidAt: new Date().toISOString().split('T')[0], paymentMethod: 'transferencia', reference: '' });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [list, sum] = await Promise.all([
        apiClient.get<Payable[]>('/api/payables'),
        apiClient.get<Summary>('/api/payables/summary'),
      ]);
      setPayables(list);
      setSummary(sum);
    } catch (error) {
      console.error('Error fetching payables:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las cuentas por pagar', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const createPayable = async () => {
    if (!form.supplierName || !form.concept || !form.totalAmount || !form.issueDate) {
      toast({ title: 'Faltan datos', description: 'Proveedor, concepto, monto y fecha son obligatorios', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.post('/api/payables', {
        ...form,
        totalAmount: Number(form.totalAmount),
        dueDate: form.dueDate || undefined,
      });
      toast({ title: 'Cuenta por pagar registrada', description: `${form.supplierName} · ${fmt(Number(form.totalAmount))}` });
      setShowForm(false);
      setForm(emptyForm);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo registrar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const registerPayment = async () => {
    if (!payFor || !payForm.amount) return;
    try {
      setSaving(true);
      await apiClient.post(`/api/payables/${payFor.id}/payments`, {
        ...payForm,
        amount: Number(payForm.amount),
      });
      toast({ title: 'Pago registrado', description: `${fmt(Number(payForm.amount))} a ${payFor.supplierName}` });
      setPayFor(null);
      setPayForm({ amount: '', paidAt: new Date().toISOString().split('T')[0], paymentMethod: 'transferencia', reference: '' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo pagar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removePayable = async (p: Payable) => {
    if (!confirm(`¿Eliminar la cuenta por pagar de ${p.supplierName}?`)) return;
    try {
      await apiClient.delete(`/api/payables/${p.id}`);
      toast({ title: 'Eliminada' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100"><Wallet className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo por pagar</p>
              <p className="text-xl font-bold text-orange-600">{fmt(summary?.saldoPorPagar || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><Building2 className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total pagado</p>
              <p className="text-xl font-bold">{fmt(summary?.totalPagado || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><FileWarning className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-xl font-bold text-red-600">{summary?.vencidas || 0}<span className="text-sm font-normal text-muted-foreground"> / {summary?.count || 0}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cuentas por Pagar</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCcw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Nueva cuenta</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Proveedor</th>
                <th className="text-left px-4 py-3">Concepto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Vence</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Saldo</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Cargando…</td></tr>
              ) : payables.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Sin cuentas por pagar.</td></tr>
              ) : payables.map((p) => {
                const saldo = p.totalAmount - p.paidAmount;
                const overdue = isOverdue(p);
                const st = STATUS[p.status] || STATUS.pendiente;
                return (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{p.supplierName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.concept}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.category || '—'}</td>
                    <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{fmtDate(p.dueDate)}</td>
                    <td className="px-4 py-3 text-right">{fmt(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(saldo)}</td>
                    <td className="px-4 py-3 text-center">
                      {overdue ? <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Vencida</Badge>
                        : <Badge variant="outline" className={st.cls}>{st.label}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.status !== 'pagado' && p.status !== 'cancelado' && (
                        <Button variant="ghost" size="sm" onClick={() => setPayFor(p)} title="Registrar pago">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removePayable(p)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva cuenta por pagar</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Proveedor *</Label>
              <Input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Nombre del proveedor" />
            </div>
            <div>
              <Label>Concepto *</Label>
              <Input value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Descripción del gasto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monto *</Label>
                <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de emisión *</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <Label>Vencimiento</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={createPayable} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago {payFor ? `· ${payFor.supplierName}` : ''}</DialogTitle></DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Saldo actual: <span className="font-semibold text-foreground">{fmt(payFor.totalAmount - payFor.paidAmount)}</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto del pago *</Label>
                  <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Método</Label>
                <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm({ ...payForm, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referencia</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancelar</Button>
            <Button onClick={registerPayment} disabled={saving || !payForm.amount}>{saving ? 'Guardando…' : 'Pagar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
