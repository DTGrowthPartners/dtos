import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, RefreshCcw, Users, HandCoins, Wallet, Pencil, FileText } from 'lucide-react';
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

interface LoanPayment {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

interface EmployeeLoan {
  id: string;
  consecutivo?: number;
  employeeName: string;
  concept: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  date: string;
  dueDate?: string;
  status: string;
  notes?: string;
  payments: LoanPayment[];
}

interface Summary {
  totalPrestado: number;
  totalAbonado: number;
  saldoPorCobrar: number;
  count: number;
  pendientes: number;
}

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');
// Consecutivo de cuenta por cobrar a empleado (ej. 1 -> "CxC-0001")
const fmtConsec = (n?: number) => (n ? `CxC-${String(n).padStart(4, '0')}` : '');

const STATUS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  parcial: { label: 'Parcial', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  pagado: { label: 'Pagado', cls: 'bg-green-100 text-green-700 border-green-200' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const emptyForm = { employeeName: '', concept: '', totalAmount: '', date: new Date().toISOString().split('T')[0], dueDate: '', notes: '' };

export default function EmployeeLoansPanel() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statementLoan, setStatementLoan] = useState<EmployeeLoan | null>(null);

  const [payFor, setPayFor] = useState<EmployeeLoan | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paidAt: new Date().toISOString().split('T')[0], paymentMethod: 'transferencia', cuentaDestino: '', reference: '', notes: '' });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [list, sum] = await Promise.all([
        apiClient.get<EmployeeLoan[]>('/api/employee-loans'),
        apiClient.get<Summary>('/api/employee-loans/summary'),
      ]);
      setLoans(list);
      setSummary(sum);
    } catch (error) {
      console.error('Error fetching employee loans:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los préstamos a empleados', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveLoan = async () => {
    if (!form.employeeName || !form.concept || !form.totalAmount || !form.date) {
      toast({ title: 'Faltan datos', description: 'Empleado, concepto, monto y fecha son obligatorios', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form, totalAmount: Number(form.totalAmount), dueDate: form.dueDate || undefined };
      if (editingId) {
        await apiClient.put(`/api/employee-loans/${editingId}`, payload);
        toast({ title: 'Préstamo actualizado', description: `${form.employeeName} · ${fmt(Number(form.totalAmount))}` });
      } else {
        await apiClient.post('/api/employee-loans', payload);
        toast({ title: 'Préstamo registrado', description: `${form.employeeName} · ${fmt(Number(form.totalAmount))}` });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (loan: EmployeeLoan) => {
    setEditingId(loan.id);
    setForm({
      employeeName: loan.employeeName,
      concept: loan.concept,
      totalAmount: String(loan.totalAmount),
      date: (loan.date || '').split('T')[0],
      dueDate: loan.dueDate ? (loan.dueDate || '').split('T')[0] : '',
      notes: loan.notes || '',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const registerPayment = async () => {
    if (!payFor || !payForm.amount) return;
    try {
      setSaving(true);
      await apiClient.post(`/api/employee-loans/${payFor.id}/payments`, {
        ...payForm,
        amount: Number(payForm.amount),
      });
      toast({ title: 'Abono registrado', description: `${fmt(Number(payForm.amount))} de ${payFor.employeeName}` });
      setPayFor(null);
      setPayForm({ amount: '', paidAt: new Date().toISOString().split('T')[0], paymentMethod: 'transferencia', cuentaDestino: '', reference: '', notes: '' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo abonar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const removeLoan = async (loan: EmployeeLoan) => {
    if (!confirm(`¿Eliminar el préstamo de ${loan.employeeName}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiClient.delete(`/api/employee-loans/${loan.id}`);
      toast({ title: 'Eliminado' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100"><HandCoins className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo por cobrar</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(summary?.saldoPorCobrar || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Wallet className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total abonado</p>
              <p className="text-xl font-bold">{fmt(summary?.totalAbonado || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Users className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Préstamos pendientes</p>
              <p className="text-xl font-bold">{summary?.pendientes || 0}<span className="text-sm font-normal text-muted-foreground"> / {summary?.count || 0}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cuentas por Cobrar a Empleados</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCcw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo préstamo</Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Empleado</th>
                <th className="text-left px-4 py-3">Concepto</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Abonado</th>
                <th className="text-right px-4 py-3">Saldo</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Cargando…</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Sin préstamos registrados.</td></tr>
              ) : loans.map((l) => {
                const saldo = l.totalAmount - l.paidAmount;
                const st = STATUS[l.status] || STATUS.pendiente;
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {l.employeeName}
                      {l.consecutivo ? <span className="block text-[11px] font-mono text-muted-foreground font-normal">{fmtConsec(l.consecutivo)}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.concept}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(l.date)}</td>
                    <td className="px-4 py-3 text-right">{fmt(l.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(l.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(saldo)}</td>
                    <td className="px-4 py-3 text-center"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setStatementLoan(l)} title="Estado de cuenta">
                        <FileText className="h-4 w-4 text-violet-600" />
                      </Button>
                      {l.status !== 'pagado' && l.status !== 'cancelado' && (
                        <Button variant="ghost" size="sm" onClick={() => setPayFor(l)} title="Registrar abono">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => startEdit(l)} title="Editar">
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeLoan(l)} title="Eliminar">
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

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setForm(emptyForm); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Editar préstamo' : 'Nuevo préstamo a empleado'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empleado *</Label>
              <Input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} placeholder="Nombre del empleado" />
            </div>
            <div>
              <Label>Concepto *</Label>
              <Input value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Anticipo de nómina, préstamo…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto *</Label>
                <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Fecha límite (opcional)</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={saveLoan} disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar abono {payFor ? `· ${payFor.employeeName}` : ''}</DialogTitle></DialogHeader>
          {payFor && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Saldo actual: <span className="font-semibold text-foreground">{fmt(payFor.totalAmount - payFor.paidAmount)}</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monto del abono *</Label>
                  <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Método de pago</Label>
                <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm({ ...payForm, paymentMethod: v, cuentaDestino: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="descuento_nomina">Descuento de nómina</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payForm.paymentMethod === 'transferencia' && (
                <div>
                  <Label>Cuenta destino *</Label>
                  <Input
                    value={payForm.cuentaDestino}
                    onChange={(e) => setPayForm({ ...payForm, cuentaDestino: e.target.value })}
                    placeholder="Ej. Bancolombia, Nequi, Daviplata…"
                  />
                </div>
              )}
              <div>
                <Label>Referencia / notas</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancelar</Button>
            <Button onClick={registerPayment} disabled={saving || !payForm.amount}>{saving ? 'Guardando…' : 'Abonar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estado de cuenta */}
      <Dialog open={!!statementLoan} onOpenChange={(o) => !o && setStatementLoan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Estado de Cuenta
              {statementLoan?.consecutivo ? <Badge variant="outline" className="font-mono">{fmtConsec(statementLoan.consecutivo)}</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {statementLoan && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{statementLoan.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{statementLoan.concept}</p>
                  <p className="text-xs text-muted-foreground mt-1">Fecha: {fmtDate(statementLoan.date)}{statementLoan.dueDate ? ` · Límite: ${fmtDate(statementLoan.dueDate)}` : ''}</p>
                </div>
                <Badge variant="outline" className={(STATUS[statementLoan.status] || STATUS.pendiente).cls}>
                  {(STATUS[statementLoan.status] || STATUS.pendiente).label}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">Total</p><p className="font-bold text-sm">{fmt(statementLoan.totalAmount)}</p></div>
                <div className="rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">Abonado</p><p className="font-bold text-sm text-green-600">{fmt(statementLoan.paidAmount)}</p></div>
                <div className="rounded-lg bg-muted p-2"><p className="text-[11px] text-muted-foreground">Saldo</p><p className="font-bold text-sm text-red-500">{fmt(statementLoan.totalAmount - statementLoan.paidAmount)}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Movimientos ({statementLoan.payments?.length || 0})</p>
                {!statementLoan.payments || statementLoan.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">Sin abonos registrados.</p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                    {statementLoan.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p>{fmtDate(p.paidAt)}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.paymentMethod || 'Abono'}{p.reference ? ` · ${p.reference}` : ''}</p>
                        </div>
                        <p className="font-medium text-green-600">{fmt(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { const l = statementLoan; setStatementLoan(null); if (l) startEdit(l); }}>
              <Pencil className="h-4 w-4 mr-2" />Editar
            </Button>
            <Button onClick={() => setStatementLoan(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
