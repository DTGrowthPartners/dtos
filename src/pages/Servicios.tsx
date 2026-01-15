import { useState, useEffect } from 'react';
import { Plus, Search, Clock, Edit, Trash2, Package, Grid3x3, LayoutGrid, Columns3, List, Eye, EyeOff, GripVertical } from 'lucide-react';
import * as Icons from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  duration?: string;
  icon: string;
  status: string;
  createdAt: string;
}

type ViewMode = '1' | '2' | '3' | 'list';

const AVAILABLE_ICONS = [
  'Briefcase', 'Package', 'ShoppingCart', 'Truck', 'Wrench', 'Code',
  'Palette', 'Camera', 'Heart', 'Home', 'Zap', 'Cloud', 'Database',
  'Globe', 'Mail', 'Phone', 'MessageCircle', 'Users', 'User', 'Shield',
  'Lock', 'Unlock', 'Settings', 'Search', 'FileText', 'Clipboard'
];

export default function Servicios() {
  const [services, setServices] = useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3');
  const [hiddenServices, setHiddenServices] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    duration: '',
    icon: 'Briefcase',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await apiClient.get<Service[]>('/api/services');
      setServices(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los servicios',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
      };

      if (editingService) {
        await apiClient.put(`/api/services/${editingService.id}`, payload);
        toast({
          title: 'Servicio actualizado',
          description: 'El servicio se actualizó correctamente',
        });
      } else {
        await apiClient.post('/api/services', payload);
        toast({
          title: 'Servicio creado',
          description: 'El servicio se creó correctamente',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar el servicio',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
      currency: service.currency,
      duration: service.duration || '',
      icon: service.icon,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;

    try {
      await apiClient.delete(`/api/services/${id}`);
      toast({
        title: 'Servicio eliminado',
        description: 'El servicio se eliminó correctamente',
      });
      fetchServices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el servicio',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', currency: 'USD', duration: '', icon: 'Briefcase' });
    setEditingService(null);
  };

  const toggleServiceVisibility = (serviceId: string) => {
    setHiddenServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Reorder locally first for instant feedback
    const reorderedServices = Array.from(filteredServices);
    const [movedService] = reorderedServices.splice(sourceIndex, 1);
    reorderedServices.splice(destinationIndex, 0, movedService);

    // Update local state
    setServices(prev => {
      const newServices = [...prev];
      const allServiceIds = reorderedServices.map(s => s.id);
      // Reorder based on filtered order
      return newServices.sort((a, b) => {
        const aIndex = allServiceIds.indexOf(a.id);
        const bIndex = allServiceIds.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    });

    // Save to backend
    try {
      await apiClient.put('/api/services/reorder', {
        serviceIds: reorderedServices.map(s => s.id),
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el orden',
        variant: 'destructive',
      });
      fetchServices(); // Reload to restore order
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isHidden = hiddenServices.has(service.id);

    if (showHidden) {
      return matchesSearch;
    }
    return matchesSearch && !isHidden;
  });

  const getGridColumns = () => {
    switch (viewMode) {
      case '1':
        return 'grid-cols-1';
      case '2':
        return 'grid-cols-1 sm:grid-cols-2';
      case '3':
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 'list':
      default:
        return '';
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : <Package className="h-5 w-5" />;
  };

  const formatPrice = (price: number, currency: string) => {
    const symbol = currency === 'COP' ? '$' : '$';
    const formatted = price.toLocaleString();
    return `${symbol}${formatted} ${currency}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Servicios</h1>
          <p className="text-muted-foreground">Servicios disponibles para todos los usuarios</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar servicio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showHidden ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            className="whitespace-nowrap"
          >
            {showHidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showHidden ? 'Ocultar ocultados' : `Mostrar ocultados (${hiddenServices.size})`}
          </Button>
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)}>
            <ToggleGroupItem value="list" aria-label="Vista de lista">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="1" aria-label="Vista de 1 columna">
              <Columns3 className="h-4 w-4 rotate-90" />
            </ToggleGroupItem>
            <ToggleGroupItem value="2" aria-label="Vista de 2 columnas">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="3" aria-label="Vista de 3 columnas">
              <Grid3x3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' ? (
        <Card>
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="min-w-[150px]">Servicio</TableHead>
                  <TableHead className="min-w-[200px]">Descripción</TableHead>
                  <TableHead className="min-w-[120px]">Precio</TableHead>
                  <TableHead className="min-w-[100px]">Duración</TableHead>
                  <TableHead className="min-w-[100px]">Estado</TableHead>
                  <TableHead className="text-right min-w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => {
                  const isHidden = hiddenServices.has(service.id);
                  return (
                    <TableRow key={service.id} className={isHidden ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {getIcon(service.icon)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {service.description || '-'}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-success whitespace-nowrap">
                          {formatPrice(service.price, service.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{service.duration || '-'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${service.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {service.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleServiceVisibility(service.id)}
                            className="h-8 w-8 p-0"
                          >
                            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(service)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(service.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Cards Grid with Drag and Drop */
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="services" direction="vertical">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`grid gap-4 ${getGridColumns()}`}
              >
                {filteredServices.map((service, index) => {
                  const isHidden = hiddenServices.has(service.id);
                  return (
                    <Draggable key={service.id} draggableId={service.id} index={index}>
                      {(provided, snapshot) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`hover:shadow-lg transition-all ${isHidden ? 'opacity-50 border-dashed' : ''} ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary' : ''}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                >
                                  <GripVertical className="h-5 w-5" />
                                </div>
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                  {getIcon(service.icon)}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">{service.name}</h3>
                                  <span className="text-xs text-muted-foreground">
                                    {service.status === 'active' ? 'Activo' : 'Inactivo'}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleServiceVisibility(service.id)}
                                className="h-8 w-8 p-0"
                              >
                                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {service.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-success text-lg break-words">
                                {formatPrice(service.price, service.currency)}
                              </span>
                            </div>
                            {service.duration && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="break-words">{service.duration}</span>
                              </div>
                            )}
                          </CardContent>
                          <CardFooter className="flex flex-wrap gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px]"
                              onClick={() => handleEdit(service)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] text-destructive hover:text-destructive"
                              onClick={() => handleDelete(service.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </Button>
                          </CardFooter>
                        </Card>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No se encontraron servicios</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Intenta con otra búsqueda' : 'Crea tu primer servicio'}
          </p>
        </div>
      )}

      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Actualiza la información del servicio'
                : 'Completa los datos del nuevo servicio'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Nombre del servicio"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icono</Label>
                <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((iconName) => {
                      const IconComponent = (Icons as any)[iconName];
                      return (
                        <SelectItem key={iconName} value={iconName}>
                          <div className="flex items-center gap-2">
                            {IconComponent && <IconComponent className="h-4 w-4" />}
                            <span>{iconName}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción del servicio"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={isLoading}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda *</Label>
                  <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - Dólar</SelectItem>
                      <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duración</Label>
                <Input
                  id="duration"
                  type="text"
                  placeholder="ej: 1 hora"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
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
                {isLoading ? 'Guardando...' : editingService ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
