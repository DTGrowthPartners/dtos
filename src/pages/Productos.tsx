import { useState, useEffect } from 'react';
import { Layers, CreditCard, MessageSquare, Users, TrendingUp, Code, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'development' | 'beta' | 'live';
  progress: number;
  users?: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  CreditCard,
  MessageSquare,
  Users,
  Code,
  TrendingUp,
};

const iconOptions = [
  { value: 'Layers', label: 'Layers' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'MessageSquare', label: 'Message Square' },
  { value: 'Users', label: 'Users' },
  { value: 'Code', label: 'Code' },
  { value: 'TrendingUp', label: 'Trending Up' },
];

const statusConfig = {
  development: { label: 'En Desarrollo', className: 'bg-warning/10 text-warning border-warning/20' },
  beta: { label: 'Beta', className: 'bg-primary/10 text-primary border-primary/20' },
  live: { label: 'En Producción', className: 'bg-success/10 text-success border-success/20' },
};

const roadmapItems = [
  { id: '1', title: 'Sistema de autenticación', product: 'DT-OS', status: 'completed', date: 'Dic 2024' },
  { id: '2', title: 'Dashboard principal', product: 'DT-OS', status: 'in_progress', date: 'Dic 2024' },
  { id: '3', title: 'Módulo CRM', product: 'DT-OS', status: 'planned', date: 'Ene 2025' },
  { id: '4', title: 'Integración Stripe', product: 'CobraFlow', status: 'completed', date: 'Nov 2024' },
  { id: '5', title: 'Panel de facturación', product: 'CobraFlow', status: 'in_progress', date: 'Dic 2024' },
  { id: '6', title: 'API WhatsApp Business', product: 'ChatSuite', status: 'in_progress', date: 'Dic 2024' },
];

const roadmapStatusConfig = {
  completed: { label: 'Completado', className: 'bg-success/10 text-success' },
  in_progress: { label: 'En Progreso', className: 'bg-primary/10 text-primary' },
  planned: { label: 'Planificado', className: 'bg-muted text-muted-foreground' },
};

export default function Productos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Layers',
    status: 'development' as 'development' | 'beta' | 'live',
    progress: 0,
    users: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await apiClient.get<Product[]>('/api/products');
      setProducts(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingProduct) {
        await apiClient.put(`/api/products/${editingProduct.id}`, formData);
        toast({
          title: 'Producto actualizado',
          description: 'El producto se actualizó correctamente',
        });
      } else {
        await apiClient.post('/api/products', formData);
        toast({
          title: 'Producto creado',
          description: 'El producto se creó correctamente',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar el producto',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      icon: product.icon,
      status: product.status,
      progress: product.progress,
      users: product.users || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
      await apiClient.delete(`/api/products/${id}`);
      toast({
        title: 'Producto eliminado',
        description: 'El producto se eliminó correctamente',
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el producto',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'Layers',
      status: 'development',
      progress: 0,
      users: 0,
    });
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productos DT Cloud Hub</h1>
          <p className="text-muted-foreground">Estado de desarrollo y métricas de uso</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
          <Button variant="outline" className="w-full md:w-auto">
            <Code className="h-4 w-4 mr-2" />
            Ver Documentación
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {products.map((product) => {
          const Icon = iconMap[product.icon] || Layers;
          const status = statusConfig[product.status];

          return (
            <div key={product.id} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="outline" className={cn('text-xs', status.className)}>
                  {status.label}
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{product.description}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium text-foreground">{product.progress}%</span>
                </div>
                <Progress value={product.progress} className="h-2" />
              </div>

              {product.users !== undefined && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{product.users} usuarios activos</span>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(product)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Roadmap */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Roadmap de Desarrollo</h3>
            <p className="text-sm text-muted-foreground">Próximas funcionalidades y mejoras</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {Object.entries(roadmapStatusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', config.className.split(' ')[0])} />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {roadmapItems.map((item) => {
            const itemStatus = roadmapStatusConfig[item.status as keyof typeof roadmapStatusConfig];
            return (
              <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', itemStatus.className.split(' ')[0])} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.product}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {item.date}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuarios Totales</p>
              <p className="text-xl font-bold text-foreground">
                {products.reduce((acc, p) => acc + (p.users || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Code className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Productos Activos</p>
              <p className="text-xl font-bold text-foreground">
                {products.filter(p => p.status === 'live').length}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Layers className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Productos en Desarrollo</p>
              <p className="text-xl font-bold text-foreground">
                {products.filter(p => p.status === 'development').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Actualiza la información del producto'
                : 'Completa los datos del nuevo producto'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Nombre del producto"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción del producto"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  disabled={isLoading}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icono</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">En Desarrollo</SelectItem>
                    <SelectItem value="beta">Beta</SelectItem>
                    <SelectItem value="live">En Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress">Progreso (%)</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="users">Usuarios Activos</Label>
                <Input
                  id="users"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.users}
                  onChange={(e) => setFormData({ ...formData, users: parseInt(e.target.value) || 0 })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
