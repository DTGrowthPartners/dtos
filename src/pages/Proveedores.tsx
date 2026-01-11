import { useState, useEffect } from 'react';
import { Plus, Building2, DollarSign, Calendar, FileText, Tag, Wallet, Send, X, Pencil, Trash2 } from 'lucide-react';
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

interface Proveedor {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ultimoPago?: number;
  ultimaFecha?: string;
}

// Proveedores predefinidos
const proveedoresPredefinidos: Proveedor[] = [
  {
    id: '1',
    nombre: 'ChatGPT / OpenAI',
    descripcion: 'Suscripción OpenAI',
    categoria: 'Software / Suscripciones',
  },
  {
    id: '2',
    nombre: 'Claude / Anthropic',
    descripcion: 'Suscripción Anthropic',
    categoria: 'Software / Suscripciones',
  },
  {
    id: '3',
    nombre: 'Almuerzos',
    descripcion: 'Gastos de alimentación',
    categoria: 'Alimentación',
  },
  {
    id: '4',
    nombre: 'Meta Ads',
    descripcion: 'Publicidad en Facebook/Instagram',
    categoria: 'Marketing',
  },
  {
    id: '5',
    nombre: 'Google Ads',
    descripcion: 'Publicidad en Google',
    categoria: 'Marketing',
  },
  {
    id: '6',
    nombre: 'Hosting / Servidores',
    descripcion: 'Servicios de hosting y servidores',
    categoria: 'Infraestructura',
  },
  {
    id: '7',
    nombre: 'Dominio',
    descripcion: 'Renovación de dominios',
    categoria: 'Infraestructura',
  },
];

const categorias = [
  'Software / Suscripciones',
  'Alimentación',
  'Marketing',
  'Infraestructura',
  'Transporte',
  'Oficina',
  'Servicios Profesionales',
  'Otros',
];

export default function Proveedores() {
  const { toast } = useToast();
  const [proveedores, setProveedores] = useState<Proveedor[]>(proveedoresPredefinidos);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showNewProveedorModal, setShowNewProveedorModal] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
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
    descripcion: '',
    categoria: '',
  });

  // Estado para editar proveedor
  const [showEditProveedorModal, setShowEditProveedorModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [editProveedorForm, setEditProveedorForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: '',
  });

  // Estado para eliminar proveedor
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [proveedorToDelete, setProveedorToDelete] = useState<Proveedor | null>(null);

  const openAddExpense = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setExpenseForm({
      fecha: new Date().toISOString().split('T')[0],
      importe: '',
      descripcion: proveedor.descripcion,
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
        categoria: selectedProveedor.categoria,
        cuenta: '',
        entidad: 'DT Growth Partners',
      });

      toast({
        title: 'Gasto registrado',
        description: `Se agregó el gasto de ${selectedProveedor.nombre} correctamente`,
      });

      // Actualizar último pago del proveedor
      setProveedores(prev =>
        prev.map(p =>
          p.id === selectedProveedor.id
            ? { ...p, ultimoPago: parseFloat(expenseForm.importe), ultimaFecha: expenseForm.fecha }
            : p
        )
      );

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

  const handleAddProveedor = () => {
    if (!proveedorForm.nombre || !proveedorForm.categoria) {
      toast({
        title: 'Error',
        description: 'Ingresa el nombre y la categoría del proveedor',
        variant: 'destructive',
      });
      return;
    }

    const newProveedor: Proveedor = {
      id: Date.now().toString(),
      nombre: proveedorForm.nombre,
      descripcion: proveedorForm.descripcion || proveedorForm.nombre,
      categoria: proveedorForm.categoria,
    };

    setProveedores(prev => [...prev, newProveedor]);
    setShowNewProveedorModal(false);
    setProveedorForm({ nombre: '', descripcion: '', categoria: '' });

    toast({
      title: 'Proveedor agregado',
      description: `${newProveedor.nombre} ha sido agregado a la lista`,
    });
  };

  const openEditProveedor = (proveedor: Proveedor) => {
    setEditingProveedor(proveedor);
    setEditProveedorForm({
      nombre: proveedor.nombre,
      descripcion: proveedor.descripcion,
      categoria: proveedor.categoria,
    });
    setShowEditProveedorModal(true);
  };

  const handleEditProveedor = () => {
    if (!editingProveedor) return;

    if (!editProveedorForm.nombre || !editProveedorForm.categoria) {
      toast({
        title: 'Error',
        description: 'Ingresa el nombre y la categoría del proveedor',
        variant: 'destructive',
      });
      return;
    }

    setProveedores(prev =>
      prev.map(p =>
        p.id === editingProveedor.id
          ? {
              ...p,
              nombre: editProveedorForm.nombre,
              descripcion: editProveedorForm.descripcion || editProveedorForm.nombre,
              categoria: editProveedorForm.categoria,
            }
          : p
      )
    );

    setShowEditProveedorModal(false);
    setEditingProveedor(null);

    toast({
      title: 'Proveedor actualizado',
      description: `${editProveedorForm.nombre} ha sido actualizado`,
    });
  };

  const openDeleteConfirm = (proveedor: Proveedor) => {
    setProveedorToDelete(proveedor);
    setShowDeleteConfirm(true);
  };

  const handleDeleteProveedor = () => {
    if (!proveedorToDelete) return;

    setProveedores(prev => prev.filter(p => p.id !== proveedorToDelete.id));
    setShowDeleteConfirm(false);

    toast({
      title: 'Proveedor eliminado',
      description: `${proveedorToDelete.nombre} ha sido eliminado`,
    });

    setProveedorToDelete(null);
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
      default:
        return '📦';
    }
  };

  // Agrupar proveedores por categoría
  const proveedoresPorCategoria = proveedores.reduce((acc, proveedor) => {
    const cat = proveedor.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(proveedor);
    return acc;
  }, {} as Record<string, Proveedor[]>);

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
                      <p className="text-sm text-muted-foreground truncate">{proveedor.descripcion}</p>
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
                      getCategoryColor(proveedor.categoria)
                    )}
                  >
                    {proveedor.categoria.split(' / ')[0]}
                  </span>

                  {proveedor.ultimoPago && (
                    <div className="mb-3 p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Último pago</p>
                      <p className="text-sm font-medium text-foreground">
                        ${proveedor.ultimoPago.toLocaleString()} - {proveedor.ultimaFecha}
                      </p>
                    </div>
                  )}

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
                    // Solo permitir números
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Nuevo Proveedor
            </DialogTitle>
            <DialogDescription>Agrega un nuevo proveedor o tercero</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proveedor-nombre">Nombre</Label>
              <Input
                id="proveedor-nombre"
                value={proveedorForm.nombre}
                onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                placeholder="Ej: Netflix, Uber, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedor-descripcion">Descripción</Label>
              <Input
                id="proveedor-descripcion"
                value={proveedorForm.descripcion}
                onChange={(e) => setProveedorForm({ ...proveedorForm, descripcion: e.target.value })}
                placeholder="Descripción breve del gasto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedor-categoria">Categoría</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProveedorModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddProveedor}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Proveedor */}
      <Dialog open={showEditProveedorModal} onOpenChange={setShowEditProveedorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Proveedor
            </DialogTitle>
            <DialogDescription>Modifica los datos del proveedor</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-proveedor-nombre">Nombre</Label>
              <Input
                id="edit-proveedor-nombre"
                value={editProveedorForm.nombre}
                onChange={(e) => setEditProveedorForm({ ...editProveedorForm, nombre: e.target.value })}
                placeholder="Ej: Netflix, Uber, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-proveedor-descripcion">Descripción</Label>
              <Input
                id="edit-proveedor-descripcion"
                value={editProveedorForm.descripcion}
                onChange={(e) => setEditProveedorForm({ ...editProveedorForm, descripcion: e.target.value })}
                placeholder="Descripción breve del gasto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-proveedor-categoria">Categoría</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProveedorModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditProveedor}>
              <Pencil className="h-4 w-4 mr-2" />
              Guardar Cambios
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
                  Esta acción no se puede deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProveedor}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
