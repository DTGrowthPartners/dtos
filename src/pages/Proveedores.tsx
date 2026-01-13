import { useState, useEffect } from 'react';
import { Plus, Building2, DollarSign, Tag, Send, Pencil, Trash2, Loader2, Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Tercero {
  id: string;
  tipo: 'cliente' | 'proveedor' | 'empleado' | 'freelancer';
  nombre: string;
  nit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  categoria?: string;
  cuentaBancaria?: string;
  salarioBase?: number;
  cargo?: string;
  estado: 'activo' | 'inactivo';
  createdAt: string;
}

const categorias = [
  'Software / Suscripciones',
  'Alimentación',
  'Marketing',
  'Infraestructura',
  'Transporte',
  'Oficina',
  'Servicios Profesionales',
  'Freelancer',
  'Otros',
];

export default function Proveedores() {
  const { toast } = useToast();
  const [proveedores, setProveedores] = useState<Tercero[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showNewProveedorModal, setShowNewProveedorModal] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Tercero | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form para agregar gasto
  const [expenseForm, setExpenseForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    descripcion: '',
    notas: '',
  });

  // Form para nuevo proveedor
  const [proveedorForm, setProveedorForm] = useState({
    nombre: '',
    nit: '',
    email: '',
    telefono: '',
    direccion: '',
    categoria: '',
    cuentaBancaria: '',
  });

  // Estado para editar proveedor
  const [showEditProveedorModal, setShowEditProveedorModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Tercero | null>(null);
  const [editProveedorForm, setEditProveedorForm] = useState({
    nombre: '',
    nit: '',
    email: '',
    telefono: '',
    direccion: '',
    categoria: '',
    cuentaBancaria: '',
  });

  // Estado para eliminar proveedor
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [proveedorToDelete, setProveedorToDelete] = useState<Tercero | null>(null);

  // Cargar proveedores desde la API
  useEffect(() => {
    loadProveedores();
  }, []);

  const loadProveedores = async () => {
    try {
      setIsLoading(true);
      const data = await apiClient.get<Tercero[]>('/api/finance/terceros?tipo=proveedor');
      setProveedores(data);
    } catch (error: any) {
      console.error('Error loading proveedores:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los proveedores',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openAddExpense = (proveedor: Tercero) => {
    setSelectedProveedor(proveedor);
    setExpenseForm({
      fecha: new Date().toISOString().split('T')[0],
      importe: '',
      descripcion: proveedor.categoria || '',
      notas: '',
    });
    setShowAddExpenseModal(true);
  };

  const handleAddExpense = async () => {
    if (!selectedProveedor) return;

    if (!expenseForm.importe || !expenseForm.descripcion) {
      toast({
        title: 'Error',
        description: 'Ingresa el importe y la descripción',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      await apiClient.post('/api/finance/expense', {
        fecha: expenseForm.fecha,
        importe: parseFloat(expenseForm.importe.replace(/[,.]/g, '')),
        descripcion: `${selectedProveedor.nombre} - ${expenseForm.descripcion}${expenseForm.notas ? ` (${expenseForm.notas})` : ''}`,
        categoria: selectedProveedor.categoria || 'Otros',
        cuenta: '',
        entidad: selectedProveedor.nombre,
      });

      toast({
        title: 'Gasto registrado',
        description: `Se agregó el gasto de ${selectedProveedor.nombre} correctamente`,
      });

      setShowAddExpenseModal(false);
      setSelectedProveedor(null);
      setExpenseForm({
        fecha: new Date().toISOString().split('T')[0],
        importe: '',
        descripcion: '',
        notas: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el gasto',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProveedor = async () => {
    if (!proveedorForm.nombre || !proveedorForm.categoria) {
      toast({
        title: 'Error',
        description: 'Ingresa el nombre y la categoría del proveedor',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      await apiClient.post('/api/finance/terceros', {
        tipo: 'proveedor',
        nombre: proveedorForm.nombre,
        nit: proveedorForm.nit || undefined,
        email: proveedorForm.email || undefined,
        telefono: proveedorForm.telefono || undefined,
        direccion: proveedorForm.direccion || undefined,
        categoria: proveedorForm.categoria,
        cuentaBancaria: proveedorForm.cuentaBancaria || undefined,
      });

      toast({
        title: 'Proveedor agregado',
        description: `${proveedorForm.nombre} ha sido agregado correctamente`,
      });

      setShowNewProveedorModal(false);
      setProveedorForm({ nombre: '', nit: '', email: '', telefono: '', direccion: '', categoria: '', cuentaBancaria: '' });
      loadProveedores();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo agregar el proveedor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditProveedor = (proveedor: Tercero) => {
    setEditingProveedor(proveedor);
    setEditProveedorForm({
      nombre: proveedor.nombre,
      nit: proveedor.nit || '',
      email: proveedor.email || '',
      telefono: proveedor.telefono || '',
      direccion: proveedor.direccion || '',
      categoria: proveedor.categoria || '',
      cuentaBancaria: proveedor.cuentaBancaria || '',
    });
    setShowEditProveedorModal(true);
  };

  const handleEditProveedor = async () => {
    if (!editingProveedor) return;

    if (!editProveedorForm.nombre || !editProveedorForm.categoria) {
      toast({
        title: 'Error',
        description: 'Ingresa el nombre y la categoría del proveedor',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      await apiClient.put(`/api/finance/terceros/${editingProveedor.id}`, {
        nombre: editProveedorForm.nombre,
        nit: editProveedorForm.nit || undefined,
        email: editProveedorForm.email || undefined,
        telefono: editProveedorForm.telefono || undefined,
        direccion: editProveedorForm.direccion || undefined,
        categoria: editProveedorForm.categoria,
        cuentaBancaria: editProveedorForm.cuentaBancaria || undefined,
      });

      toast({
        title: 'Proveedor actualizado',
        description: `${editProveedorForm.nombre} ha sido actualizado`,
      });

      setShowEditProveedorModal(false);
      setEditingProveedor(null);
      loadProveedores();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el proveedor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirm = (proveedor: Tercero) => {
    setProveedorToDelete(proveedor);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProveedor = async () => {
    if (!proveedorToDelete) return;

    try {
      setIsSaving(true);

      await apiClient.delete(`/api/finance/terceros/${proveedorToDelete.id}`);

      toast({
        title: 'Proveedor eliminado',
        description: `${proveedorToDelete.nombre} ha sido eliminado`,
      });

      setShowDeleteConfirm(false);
      setProveedorToDelete(null);
      loadProveedores();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el proveedor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryColor = (categoria: string) => {
    const colors: Record<string, string> = {
      'Software / Suscripciones': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      'Alimentación': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      'Marketing': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      'Infraestructura': 'bg-green-500/10 text-green-600 border-green-500/20',
      'Transporte': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      'Oficina': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      'Servicios Profesionales': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      'Freelancer': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
      'Otros': 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    };
    return colors[categoria] || colors['Otros'];
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria) {
      case 'Software / Suscripciones':
        return '💻';
      case 'Alimentación':
        return '🍽️';
      case 'Marketing':
        return '📢';
      case 'Infraestructura':
        return '🖥️';
      case 'Transporte':
        return '🚗';
      case 'Oficina':
        return '🏢';
      case 'Servicios Profesionales':
        return '👔';
      case 'Freelancer':
        return '👨‍💻';
      default:
        return '📦';
    }
  };

  // Agrupar proveedores por categoría
  const proveedoresPorCategoria = proveedores.reduce((acc, proveedor) => {
    const cat = proveedor.categoria || 'Otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(proveedor);
    return acc;
  }, {} as Record<string, Tercero[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
          <p className="text-muted-foreground">Gestiona los gastos con terceros y proveedores</p>
        </div>
        <Button onClick={() => setShowNewProveedorModal(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Proveedores</p>
              <p className="text-2xl font-bold text-foreground">{proveedores.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Tag className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categorías</p>
              <p className="text-2xl font-bold text-foreground">{Object.keys(proveedoresPorCategoria).length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gastos Rápidos</p>
              <p className="text-sm font-medium text-foreground">Registra pagos fácilmente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Proveedores por Categoría */}
      {proveedores.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No hay proveedores</h3>
          <p className="text-muted-foreground mb-4">Agrega tu primer proveedor para comenzar</p>
          <Button onClick={() => setShowNewProveedorModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Proveedor
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(proveedoresPorCategoria).map(([categoria, provs]) => (
            <div key={categoria} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getCategoryIcon(categoria)}</span>
                <h2 className="text-lg font-semibold text-foreground">{categoria}</h2>
                <span className="text-sm text-muted-foreground">({provs.length})</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {provs.map((proveedor) => (
                  <div
                    key={proveedor.id}
                    className="group rounded-xl border border-border bg-card p-5 hover:shadow-lg transition-all duration-200 hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{proveedor.nombre}</h3>
                        {proveedor.nit && (
                          <p className="text-xs text-muted-foreground">NIT: {proveedor.nit}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditProveedor(proveedor)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => openDeleteConfirm(proveedor)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'inline-block text-xs px-2 py-1 rounded-full border font-medium mb-3',
                        getCategoryColor(proveedor.categoria || 'Otros')
                      )}
                    >
                      {(proveedor.categoria || 'Otros').split(' / ')[0]}
                    </span>

                    {/* Contact info */}
                    <div className="space-y-1 mb-3 text-xs text-muted-foreground">
                      {proveedor.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{proveedor.email}</span>
                        </div>
                      )}
                      {proveedor.telefono && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{proveedor.telefono}</span>
                        </div>
                      )}
                      {proveedor.direccion && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{proveedor.direccion}</span>
                        </div>
                      )}
                      {proveedor.cuentaBancaria && (
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          <span className="truncate">{proveedor.cuentaBancaria}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => openAddExpense(proveedor)}
                      className="w-full"
                      variant="outline"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Registrar Pago
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agregar Gasto */}
      <Dialog open={showAddExpenseModal} onOpenChange={setShowAddExpenseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Registrar Pago
            </DialogTitle>
            <DialogDescription>
              {selectedProveedor && (
                <span className="font-medium text-foreground">{selectedProveedor.nombre}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expense-fecha">Fecha</Label>
              <Input
                id="expense-fecha"
                type="date"
                value={expenseForm.fecha}
                onChange={(e) => setExpenseForm({ ...expenseForm, fecha: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-importe">Importe (COP)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="expense-importe"
                  type="text"
                  value={expenseForm.importe}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setExpenseForm({ ...expenseForm, importe: value });
                  }}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
              {expenseForm.importe && (
                <p className="text-xs text-muted-foreground">
                  ${parseInt(expenseForm.importe || '0').toLocaleString()} COP
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-descripcion">Descripción</Label>
              <Input
                id="expense-descripcion"
                value={expenseForm.descripcion}
                onChange={(e) => setExpenseForm({ ...expenseForm, descripcion: e.target.value })}
                placeholder="Descripción del pago"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-notas">Notas adicionales (opcional)</Label>
              <Textarea
                id="expense-notas"
                value={expenseForm.notas}
                onChange={(e) => setExpenseForm({ ...expenseForm, notas: e.target.value })}
                placeholder="Información adicional..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExpense} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Registrar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nuevo Proveedor */}
      <Dialog open={showNewProveedorModal} onOpenChange={setShowNewProveedorModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Nuevo Proveedor
            </DialogTitle>
            <DialogDescription>Agrega un nuevo proveedor o tercero</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor-nombre">Nombre *</Label>
                <Input
                  id="proveedor-nombre"
                  value={proveedorForm.nombre}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                  placeholder="Ej: Netflix, Uber, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor-nit">NIT / Documento</Label>
                <Input
                  id="proveedor-nit"
                  value={proveedorForm.nit}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, nit: e.target.value })}
                  placeholder="123456789-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor-email">Email</Label>
                <Input
                  id="proveedor-email"
                  type="email"
                  value={proveedorForm.email}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, email: e.target.value })}
                  placeholder="contacto@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor-telefono">Teléfono</Label>
                <Input
                  id="proveedor-telefono"
                  value={proveedorForm.telefono}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })}
                  placeholder="+57 300 123 4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedor-direccion">Dirección</Label>
              <Input
                id="proveedor-direccion"
                value={proveedorForm.direccion}
                onChange={(e) => setProveedorForm({ ...proveedorForm, direccion: e.target.value })}
                placeholder="Calle 123 # 45-67"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor-categoria">Categoría *</Label>
                <Select
                  value={proveedorForm.categoria}
                  onValueChange={(value) => setProveedorForm({ ...proveedorForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategoryIcon(cat)} {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proveedor-cuenta">Cuenta Bancaria</Label>
                <Input
                  id="proveedor-cuenta"
                  value={proveedorForm.cuentaBancaria}
                  onChange={(e) => setProveedorForm({ ...proveedorForm, cuentaBancaria: e.target.value })}
                  placeholder="Banco - # Cuenta"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProveedorModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddProveedor} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Proveedor
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Proveedor */}
      <Dialog open={showEditProveedorModal} onOpenChange={setShowEditProveedorModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Proveedor
            </DialogTitle>
            <DialogDescription>Modifica los datos del proveedor</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-nombre">Nombre *</Label>
                <Input
                  id="edit-proveedor-nombre"
                  value={editProveedorForm.nombre}
                  onChange={(e) => setEditProveedorForm({ ...editProveedorForm, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-nit">NIT / Documento</Label>
                <Input
                  id="edit-proveedor-nit"
                  value={editProveedorForm.nit}
                  onChange={(e) => setEditProveedorForm({ ...editProveedorForm, nit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-email">Email</Label>
                <Input
                  id="edit-proveedor-email"
                  type="email"
                  value={editProveedorForm.email}
                  onChange={(e) => setEditProveedorForm({ ...editProveedorForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-telefono">Teléfono</Label>
                <Input
                  id="edit-proveedor-telefono"
                  value={editProveedorForm.telefono}
                  onChange={(e) => setEditProveedorForm({ ...editProveedorForm, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-proveedor-direccion">Dirección</Label>
              <Input
                id="edit-proveedor-direccion"
                value={editProveedorForm.direccion}
                onChange={(e) => setEditProveedorForm({ ...editProveedorForm, direccion: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-categoria">Categoría *</Label>
                <Select
                  value={editProveedorForm.categoria}
                  onValueChange={(value) => setEditProveedorForm({ ...editProveedorForm, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategoryIcon(cat)} {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-proveedor-cuenta">Cuenta Bancaria</Label>
                <Input
                  id="edit-proveedor-cuenta"
                  value={editProveedorForm.cuentaBancaria}
                  onChange={(e) => setEditProveedorForm({ ...editProveedorForm, cuentaBancaria: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProveedorModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditProveedor} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Eliminar Proveedor
            </DialogTitle>
            <DialogDescription>
              {proveedorToDelete && (
                <>
                  ¿Estás seguro de que deseas eliminar a <span className="font-semibold text-foreground">{proveedorToDelete.nombre}</span>?
                  El proveedor será desactivado y no aparecerá en la lista.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProveedor} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
