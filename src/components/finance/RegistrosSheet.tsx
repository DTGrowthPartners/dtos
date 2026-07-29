import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2, Check, X, Plus, ArrowUpDown, FilterX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  rowIndex: number;
  fecha: string;
  importe: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
  terceroId?: string;
  noCuentaCobro?: string;
}

interface RegistrosSheetProps {
  type: 'ingreso' | 'gasto';
  data: Transaction[];
  categories: string[];
  accounts: string[];
  onRefresh: () => void | Promise<void>;
  onAddNew: () => void;
}

type SortOrder = 'asc' | 'desc';

interface ColumnFilters {
  month: string;
  importeMin: string;
  importeMax: string;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
  noCuentaCobro: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  month: 'todos',
  importeMin: '',
  importeMax: '',
  descripcion: '',
  categoria: 'todas',
  cuenta: 'todas',
  entidad: 'todas',
  noCuentaCobro: '',
};

// Normaliza cualquier formato de fecha entrante (DD/MM/YYYY, YYYY-MM-DD, con hora) a YYYY-MM-DD para el <input type="date">
function toDateInputValue(fecha: string): string {
  if (!fecha) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
  const match = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return fecha;
}

function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month) return yyyyMm;
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function RegistrosSheet({ type, data, categories, accounts, onRefresh, onAddNew }: RegistrosSheetProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { toast } = useToast();

  const endpoint = type === 'ingreso' ? 'income' : 'expense';
  const amountColorClass = type === 'ingreso' ? 'text-success' : 'text-destructive';
  const showCuentaCobro = type === 'ingreso';

  const setFilter = <K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.month !== 'todos' ||
      filters.importeMin !== '' ||
      filters.importeMax !== '' ||
      filters.descripcion !== '' ||
      filters.categoria !== 'todas' ||
      filters.cuenta !== 'todas' ||
      filters.entidad !== 'todas' ||
      filters.noCuentaCobro !== '' ||
      searchTerm !== ''
    );
  }, [filters, searchTerm]);

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchTerm('');
  };

  const months = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => {
      const d = toDateInputValue(t.fecha);
      if (d.length >= 7) set.add(d.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const uniqueCategorias = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => t.categoria && set.add(t.categoria));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const uniqueCuentas = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => t.cuenta && set.add(t.cuenta));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const uniqueEntidades = useMemo(() => {
    const set = new Set<string>();
    data.forEach((t) => t.entidad && set.add(t.entidad));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const dateA = toDateInputValue(a.fecha);
      const dateB = toDateInputValue(b.fecha);
      if (dateA !== dateB) {
        return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      // Misma fecha: desempata por orden de fila (más reciente = fila más alta en la hoja)
      return sortOrder === 'asc' ? a.rowIndex - b.rowIndex : b.rowIndex - a.rowIndex;
    });
  }, [data, sortOrder]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const descTerm = filters.descripcion.trim().toLowerCase();
    const cuentaCobroTerm = filters.noCuentaCobro.trim().toLowerCase();
    const min = filters.importeMin !== '' ? Number(filters.importeMin) : null;
    const max = filters.importeMax !== '' ? Number(filters.importeMax) : null;

    return sorted.filter((t) => {
      if (term) {
        const matchesSearch = [t.fecha, t.descripcion, t.categoria, t.cuenta, t.entidad, t.noCuentaCobro]
          .filter(Boolean)
          .some((field) => field!.toString().toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }
      if (filters.month !== 'todos' && toDateInputValue(t.fecha).slice(0, 7) !== filters.month) return false;
      if (min !== null && !Number.isNaN(min) && t.importe < min) return false;
      if (max !== null && !Number.isNaN(max) && t.importe > max) return false;
      if (descTerm && !t.descripcion?.toLowerCase().includes(descTerm)) return false;
      if (filters.categoria !== 'todas' && t.categoria !== filters.categoria) return false;
      if (filters.cuenta !== 'todas' && t.cuenta !== filters.cuenta) return false;
      if (filters.entidad !== 'todas' && t.entidad !== filters.entidad) return false;
      if (cuentaCobroTerm && !t.noCuentaCobro?.toLowerCase().includes(cuentaCobroTerm)) return false;
      return true;
    });
  }, [sorted, searchTerm, filters]);

  const total = useMemo(() => filtered.reduce((sum, t) => sum + (t.importe || 0), 0), [filtered]);

  const startEditing = (t: Transaction) => {
    setEditingRowIndex(t.rowIndex);
    setEditForm({ ...t, fecha: toDateInputValue(t.fecha) });
  };

  const cancelEditing = () => {
    setEditingRowIndex(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (editingRowIndex === null) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fecha: editForm.fecha,
        importe: editForm.importe,
        descripcion: editForm.descripcion,
        categoria: editForm.categoria,
        cuenta: editForm.cuenta,
        entidad: editForm.entidad,
      };
      if (showCuentaCobro) body.noCuentaCobro = editForm.noCuentaCobro;
      await apiClient.put(`/api/finance/${endpoint}/${editingRowIndex}`, body);
      toast({ title: 'Actualizado', description: 'Registro actualizado correctamente' });
      setEditingRowIndex(null);
      setEditForm({});
      await onRefresh();
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el registro',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rowIndex: number) => {
    if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return;
    try {
      await apiClient.delete(`/api/finance/${endpoint}/${rowIndex}`);
      toast({ title: 'Eliminado', description: 'Registro eliminado correctamente' });
      await onRefresh();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el registro',
        variant: 'destructive',
      });
    }
  };

  const colCount = showCuentaCobro ? 9 : 8;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground">
            {type === 'ingreso' ? 'Registros de Ingresos (Entradas)' : 'Registros de Gastos (Salidas)'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} • Total ${total.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar en todos los campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} title="Limpiar filtros">
              <FilterX className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
          <Button size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </div>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-muted">
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-muted-foreground text-xs w-[36px] text-center">#</th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  className="flex items-center gap-1 hover:text-primary"
                  title={sortOrder === 'asc' ? 'Ordenando: más antigua primero' : 'Ordenando: más reciente primero'}
                >
                  Fecha
                  <ArrowUpDown className={`h-3 w-3 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                </button>
              </th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-right whitespace-nowrap">Importe</th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left">Descripción</th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left">Categoría</th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left">Cuenta</th>
              <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left">Entidad</th>
              {showCuentaCobro && (
                <th className="sticky top-0 z-10 bg-muted border-b border-r border-border py-2 px-2 font-medium text-foreground text-left whitespace-nowrap">Cuenta de Cobro</th>
              )}
              <th className="sticky top-0 z-10 bg-muted border-b border-border py-2 px-2 font-medium text-foreground text-center w-[90px]">Acciones</th>
            </tr>
            {/* Fila de filtros por columna */}
            <tr className="bg-muted/70">
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1"></th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <select
                  value={filters.month}
                  onChange={(e) => setFilter('month', e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]"
                >
                  <option value="todos">Todos los meses</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <div className="flex items-center gap-0.5">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.importeMin}
                    onChange={(e) => setFilter('importeMin', e.target.value)}
                    className="h-7 text-[11px] px-1 w-[52px]"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.importeMax}
                    onChange={(e) => setFilter('importeMax', e.target.value)}
                    className="h-7 text-[11px] px-1 w-[52px]"
                  />
                </div>
              </th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <Input
                  type="text"
                  placeholder="Filtrar..."
                  value={filters.descripcion}
                  onChange={(e) => setFilter('descripcion', e.target.value)}
                  className="h-7 text-[11px] px-1"
                />
              </th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <select
                  value={filters.categoria}
                  onChange={(e) => setFilter('categoria', e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]"
                >
                  <option value="todas">Todas</option>
                  {uniqueCategorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <select
                  value={filters.cuenta}
                  onChange={(e) => setFilter('cuenta', e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]"
                >
                  <option value="todas">Todas</option>
                  {uniqueCuentas.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </th>
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                <select
                  value={filters.entidad}
                  onChange={(e) => setFilter('entidad', e.target.value)}
                  className="h-7 w-full rounded border border-input bg-background px-1 text-[11px]"
                >
                  <option value="todas">Todas</option>
                  {uniqueEntidades.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </th>
              {showCuentaCobro && (
                <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-r border-border p-1">
                  <Input
                    type="text"
                    placeholder="Filtrar..."
                    value={filters.noCuentaCobro}
                    onChange={(e) => setFilter('noCuentaCobro', e.target.value)}
                    className="h-7 text-[11px] px-1"
                  />
                </th>
              )}
              <th className="sticky top-[33px] z-10 bg-muted/70 border-b border-border p-1"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((t, idx) => {
                const isEditing = editingRowIndex === t.rowIndex;
                return (
                  <tr key={t.rowIndex} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="border border-border py-1 px-2 text-center text-[10px] text-muted-foreground">{idx + 1}</td>
                    {isEditing ? (
                      <>
                        <td className="border border-border p-1">
                          <Input
                            type="date"
                            value={editForm.fecha || ''}
                            onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="border border-border p-1">
                          <Input
                            type="number"
                            value={editForm.importe ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, importe: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="border border-border p-1">
                          <Input
                            value={editForm.descripcion || ''}
                            onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="border border-border p-1">
                          <select
                            value={editForm.categoria || ''}
                            onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="">--</option>
                            {editForm.categoria && !categories.includes(editForm.categoria) && (
                              <option value={editForm.categoria}>{editForm.categoria}</option>
                            )}
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-border p-1">
                          <select
                            value={editForm.cuenta || ''}
                            onChange={(e) => setEditForm({ ...editForm, cuenta: e.target.value })}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="">--</option>
                            {editForm.cuenta && !accounts.includes(editForm.cuenta) && (
                              <option value={editForm.cuenta}>{editForm.cuenta}</option>
                            )}
                            {accounts.map((acc) => (
                              <option key={acc} value={acc}>{acc}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-border p-1">
                          <Input
                            value={editForm.entidad || ''}
                            onChange={(e) => setEditForm({ ...editForm, entidad: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        {showCuentaCobro && (
                          <td className="border border-border p-1">
                            <Input
                              value={editForm.noCuentaCobro || ''}
                              onChange={(e) => setEditForm({ ...editForm, noCuentaCobro: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </td>
                        )}
                        <td className="border border-border p-1">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-success/20 text-success" title="Guardar">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditing} disabled={saving} className="p-1 rounded hover:bg-destructive/20 text-destructive" title="Cancelar">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border border-border py-1.5 px-2 whitespace-nowrap text-xs">{t.fecha}</td>
                        <td className={`border border-border py-1.5 px-2 text-right font-medium whitespace-nowrap ${amountColorClass}`}>
                          ${t.importe.toLocaleString()}
                        </td>
                        <td className="border border-border py-1.5 px-2 max-w-[220px] truncate" title={t.descripcion}>{t.descripcion}</td>
                        <td className="border border-border py-1.5 px-2 text-muted-foreground max-w-[160px] truncate" title={t.categoria}>{t.categoria}</td>
                        <td className="border border-border py-1.5 px-2 text-muted-foreground whitespace-nowrap">{t.cuenta}</td>
                        <td className="border border-border py-1.5 px-2 text-muted-foreground max-w-[150px] truncate" title={t.entidad}>{t.entidad}</td>
                        {showCuentaCobro && (
                          <td className="border border-border py-1.5 px-2 text-muted-foreground whitespace-nowrap max-w-[150px] truncate" title={t.noCuentaCobro}>{t.noCuentaCobro || '—'}</td>
                        )}
                        <td className="border border-border py-1.5 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEditing(t)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(t.rowIndex)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive" title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={colCount} className="border border-border py-8 text-center text-muted-foreground">
                  {hasActiveFilters ? 'No hay registros que coincidan con los filtros' : 'No hay registros'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
