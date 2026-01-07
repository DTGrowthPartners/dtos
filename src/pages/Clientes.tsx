import { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, MapPin, Edit, Trash2, Building2, Grid3x3, LayoutGrid, Columns3, Eye, EyeOff, List, Upload } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo: string;
  status: string;
  createdAt: string;
}

type ViewMode = '1' | '2' | '3' | 'list';

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3');
  const [hiddenClients, setHiddenClients] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    nit: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await apiClient.get<Client[]>('/api/clients');
      setClients(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los clientes',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingClient) {
        await apiClient.put(`/api/clients/${editingClient.id}`, formData);
        toast({
          title: 'Cliente actualizado',
          description: 'El cliente se actualizó correctamente',
        });
      } else {
        await apiClient.post('/api/clients', formData);
        toast({
          title: 'Cliente creado',
          description: 'El cliente se creó correctamente',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar el cliente',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      nit: client.nit || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return;

    try {
      await apiClient.delete(`/api/clients/${id}`);
      toast({
        title: 'Cliente eliminado',
        description: 'El cliente se eliminó correctamente',
      });
      fetchClients();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el cliente',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', nit: '', phone: '', address: '' });
    setEditingClient(null);
  };

  const handleImportClients = async () => {
    try {
      const response = await fetch('/data/clientes-migracion.json');
      const data = await response.json();

      let successCount = 0;
      let errorCount = 0;

      for (const clientData of data.clientes) {
        try {
          await apiClient.post('/api/clients', clientData);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Error al importar cliente:', clientData.name, error);
        }
      }

      toast({
        title: 'Importación completada',
        description: `${successCount} clientes importados, ${errorCount} errores`,
      });

      fetchClients();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron importar los clientes',
        variant: 'destructive',
      });
    }
  };

  const toggleClientVisibility = (clientId: string) => {
    setHiddenClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());
    const isHidden = hiddenClients.has(client.id);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Clientes</h1>
          <p className="text-muted-foreground">Clientes disponibles para todos los usuarios</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleImportClients}
            className="w-full md:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Clientes
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
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
            {showHidden ? 'Ocultar ocultados' : `Mostrar ocultados (${hiddenClients.size})`}
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
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead className="min-w-[180px]">Email</TableHead>
                  <TableHead className="min-w-[120px]">NIT/RUT</TableHead>
                  <TableHead className="min-w-[120px]">Teléfono</TableHead>
                  <TableHead className="min-w-[100px]">Estado</TableHead>
                  <TableHead className="text-right min-w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const isHidden = hiddenClients.has(client.id);
                  return (
                    <TableRow key={client.id} className={isHidden ? 'opacity-50' : ''}>
                      <TableCell>
                        <img
                          src={client.logo}
                          alt={client.name}
                          className="h-8 w-8 rounded object-contain bg-muted p-1"
                          onError={(e) => {
                            e.currentTarget.src = '/img/logo.png';
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground">{client.email}</TableCell>
                      <TableCell className="text-muted-foreground">{client.nit || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{client.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {client.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleClientVisibility(client.id)}
                            className="h-8 w-8 p-0"
                          >
                            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(client)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(client.id)}
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
        /* Cards Grid */
        <div className={`grid gap-4 ${getGridColumns()}`}>
          {filteredClients.map((client) => {
            const isHidden = hiddenClients.has(client.id);
            return (
              <Card key={client.id} className={`hover:shadow-lg transition-all ${isHidden ? 'opacity-50 border-dashed' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={client.logo}
                        alt={client.name}
                        className="h-12 w-12 rounded-lg object-contain bg-muted p-2"
                        onError={(e) => {
                          e.currentTarget.src = '/img/logo.png';
                        }}
                      />
                      <div>
                        <h3 className="font-semibold text-lg">{client.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {client.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleClientVisibility(client.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate break-words">{client.email}</span>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">{client.phone}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate break-words">{client.address}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[100px]"
                    onClick={() => handleEdit(client)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[100px] text-destructive hover:text-destructive"
                    onClick={() => handleDelete(client.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No se encontraron clientes</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Intenta con otra búsqueda' : 'Crea tu primer cliente'}
          </p>
        </div>
      )}

      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? 'Actualiza la información del cliente'
                : 'Completa los datos del nuevo cliente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  placeholder="Nombre del cliente"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nit">NIT/RUT</Label>
                <Input
                  id="nit"
                  type="text"
                  placeholder="123456789-0"
                  value={formData.nit}
                  onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+34 123 456 789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Textarea
                  id="address"
                  placeholder="Dirección completa"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={isLoading}
                  rows={3}
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
                {isLoading ? 'Guardando...' : editingClient ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
