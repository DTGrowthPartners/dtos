import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCcw, Boxes, Package, Archive } from 'lucide-react';
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface FixedAsset {
  id: string;
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  currency: string;
  quantity: number;
  serialNumber?: string;
  location?: string;
  responsible?: string;
  status: string;
  disposalDate?: string;
  notes?: string;
}

interface Summary {
  valorTotal: number;
  totalActivos: number;
  registros: number;
  dadosDeBaja: number;
  byCategory: Record<string, { count: number; valor: number }>;
}

const fmt = (n: number) => '$' + (n || 0).toLocaleString('es-CO');
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');

const CATEGORIES: Record<string, string> = {
  equipo_computo: 'Equipo de cómputo',
  muebles: 'Muebles y enseres',
  vehiculos: 'Vehículos',
  maquinaria: 'Maquinaria y equipo',
  otros: 'Otros',
};

const STATUS: Record<string, { label: string; cls: string }> = {
  activo: { label: 'Activo', cls: 'bg-green-100 text-green-700 border-green-200' },
  en_reparacion: { label: 'En reparación', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  dado_de_baja: { label: 'Dado de baja', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const emptyForm = {
  name: '', category: 'equipo_computo', cost: '', acquisitionDate: new Date().toISOString().split('T')[0],
  quantity: '1', serialNumber: '', location: '', responsible: '', notes: '',
};

export default function FixedAssetsPanel() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [list, sum] = await Promise.all([
        apiClient.get<FixedAsset[]>('/api/fixed-assets'),
        apiClient.get<Summary>('/api/fixed-assets/summary'),
      ]);
      setAssets(list);
      setSummary(sum);
    } catch (error) {
      console.error('Error fetching fixed assets:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los activos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const saveAsset = async () => {
    if (!form.name || !form.category || !form.cost || !form.acquisitionDate) {
      toast({ title: 'Faltan datos', description: 'Nombre, categoría, costo y fecha son obligatorios', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form, cost: Number(form.cost), quantity: Number(form.quantity) || 1 };
      if (editingId) {
        await apiClient.put(`/api/fixed-assets/${editingId}`, payload);
        toast({ title: 'Activo actualizado', description: `${form.name} · ${fmt(Number(form.cost))}` });
      } else {
        await apiClient.post('/api/fixed-assets', payload);
        toast({ title: 'Activo registrado', description: `${form.name} · ${fmt(Number(form.cost))}` });
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

  const startEdit = (a: FixedAsset) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      category: a.category,
      cost: String(a.cost),
      acquisitionDate: (a.acquisitionDate || '').split('T')[0],
      quantity: String(a.quantity ?? 1),
      serialNumber: a.serialNumber || '',
      location: a.location || '',
      responsible: a.responsible || '',
      notes: a.notes || '',
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const changeStatus = async (a: FixedAsset, status: string) => {
    try {
      await apiClient.put(`/api/fixed-assets/${a.id}`, {
        status,
        disposalDate: status === 'dado_de_baja' ? new Date().toISOString().split('T')[0] : undefined,
      });
      toast({ title: 'Actualizado', description: `${a.name}: ${STATUS[status]?.label || status}` });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const removeAsset = async (a: FixedAsset) => {
    if (!confirm(`¿Eliminar el activo "${a.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiClient.delete(`/api/fixed-assets/${a.id}`);
      toast({ title: 'Eliminado' });
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
            <div className="p-2 rounded-lg bg-indigo-100"><Boxes className="h-5 w-5 text-indigo-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Valor total (activos)</p>
              <p className="text-xl font-bold text-indigo-600">{fmt(summary?.valorTotal || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><Package className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Unidades activas</p>
              <p className="text-xl font-bold">{summary?.totalActivos || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100"><Archive className="h-5 w-5 text-gray-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Dados de baja</p>
              <p className="text-xl font-bold">{summary?.dadosDeBaja || 0}<span className="text-sm font-normal text-muted-foreground"> / {summary?.registros || 0}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Propiedad, Planta y Equipo</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCcw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo activo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Activo</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Adquisición</th>
                <th className="text-center px-4 py-3">Cant.</th>
                <th className="text-right px-4 py-3">Costo</th>
                <th className="text-left px-4 py-3">Responsable</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Cargando…</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Sin activos registrados.</td></tr>
              ) : assets.map((a) => {
                const st = STATUS[a.status] || STATUS.activo;
                return (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.name}</div>
                      {a.serialNumber && <div className="text-xs text-muted-foreground">S/N: {a.serialNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{CATEGORIES[a.category] || a.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.acquisitionDate)}</td>
                    <td className="px-4 py-3 text-center">{a.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(a.cost)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.responsible || '—'}</td>
                    <td className="px-4 py-3 text-center"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(a)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          {a.status !== 'activo' && <DropdownMenuItem onClick={() => changeStatus(a, 'activo')}>Marcar activo</DropdownMenuItem>}
                          {a.status !== 'en_reparacion' && <DropdownMenuItem onClick={() => changeStatus(a, 'en_reparacion')}>En reparación</DropdownMenuItem>}
                          {a.status !== 'dado_de_baja' && <DropdownMenuItem onClick={() => changeStatus(a, 'dado_de_baja')}>Dar de baja</DropdownMenuItem>}
                          <DropdownMenuItem className="text-red-600" onClick={() => removeAsset(a)}>
                            <Trash2 className="h-4 w-4 mr-2" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          <DialogHeader><DialogTitle>{editingId ? 'Editar activo (PP&E)' : 'Nuevo activo (PP&E)'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre del activo *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. MacBook Pro 14, Escritorio…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Costo *</Label>
                <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de compra *</Label>
                <Input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Serial / placa</Label>
                <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <Label>Responsable</Label>
                <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Custodio" />
              </div>
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Oficina, bodega…" />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={saveAsset} disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
