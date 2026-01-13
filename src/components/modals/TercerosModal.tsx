import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Users, Plus, Edit, Trash, Search } from 'lucide-react';
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

export function TercerosModal({ onClose }: { onClose: () => void }) {
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTercero, setEditingTercero] = useState<Tercero | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'activo' | 'inactivo'>('activo');
  const [filterTipo, setFilterTipo] = useState<'todos' | 'cliente' | 'proveedor' | 'empleado' | 'freelancer'>('todos');

  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    tipo: 'cliente' | 'proveedor' | 'empleado' | 'freelancer';
    nombre: string;
    nit: string;
    email: string;
    telefono: string;
    direccion: string;
    categoria: string;
    cuentaBancaria: string;
    salarioBase: string;
    cargo: string;
    estado: 'activo' | 'inactivo';
  }>({
    tipo: 'proveedor',
    nombre: '',
    nit: '',
    email: '',
    telefono: '',
    direccion: '',
    categoria: '',
    cuentaBancaria: '',
    salarioBase: '',
    cargo: '',
    estado: 'activo',
  });

  useEffect(() => {
    fetchTerceros();
  }, []);

  const fetchTerceros = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/finance/terceros');
      setTerceros(response.data);
    } catch (error) {
      console.error('Error fetching terceros:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los terceros',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTercero) {
        await apiClient.put(`/api/finance/terceros/${editingTercero.id}`, formData);
        toast({
          title: 'Éxito',
          description: 'Tercero actualizado correctamente',
        });
      } else {
        await apiClient.post('/api/finance/terceros', formData);
        toast({
          title: 'Éxito',
          description: 'Tercero agregado correctamente',
        });
      }
      setShowForm(false);
      setEditingTercero(null);
      fetchTerceros();
      resetForm();
    } catch (error) {
      console.error('Error saving tercero:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el tercero',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este tercero?')) {
      try {
        await apiClient.delete(`/api/finance/terceros/${id}`);
        toast({
          title: 'Éxito',
          description: 'Tercero eliminado correctamente',
        });
        fetchTerceros();
      } catch (error) {
        console.error('Error deleting tercero:', error);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el tercero',
          variant: 'destructive',
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: 'proveedor',
      nombre: '',
      nit: '',
      email: '',
      telefono: '',
      direccion: '',
      categoria: '',
      cuentaBancaria: '',
      salarioBase: '',
      cargo: '',
      estado: 'activo',
    });
  };

  const filteredTerceros = terceros.filter(tercero => {
    const matchesSearch = searchTerm === '' || 
      tercero.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tercero.nit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tercero.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = filterType === 'todos' || tercero.estado === filterType;
    const matchesTipo = filterTipo === 'todos' || tercero.tipo === filterTipo;

    return matchesSearch && matchesEstado && matchesTipo;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h3 className="font-semibold text-xl text-foreground">Gestión de Terceros</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {!showForm ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar terceros..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>

              <Select value={filterType} onValueChange={(value: 'todos' | 'activo' | 'inactivo') => setFilterType(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Inactivos</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterTipo} onValueChange={(value: 'todos' | 'cliente' | 'proveedor' | 'empleado' | 'freelancer') => setFilterTipo(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="proveedor">Proveedores</SelectItem>
                  <SelectItem value="empleado">Empleados</SelectItem>
                  <SelectItem value="freelancer">Freelancers</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={() => {
                setShowForm(true);
                setEditingTercero(null);
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Tercero
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Nombre</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">NIT</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTerceros.length > 0 ? (
                      filteredTerceros.map((tercero) => (
                        <tr key={tercero.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-2 text-foreground">{tercero.nombre}</td>
                          <td className="py-3 px-2 text-foreground">{tercero.tipo}</td>
                          <td className="py-3 px-2 text-muted-foreground">{tercero.nit || '-'}</td>
                          <td className="py-3 px-2 text-muted-foreground">{tercero.email || '-'}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              tercero.estado === 'activo' 
                                ? 'bg-success/10 text-success' 
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {tercero.estado}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingTercero(tercero);
                                  setFormData({
                                    tipo: tercero.tipo,
                                    nombre: tercero.nombre,
                                    nit: tercero.nit || '',
                                    email: tercero.email || '',
                                    telefono: tercero.telefono || '',
                                    direccion: tercero.direccion || '',
                                    categoria: tercero.categoria || '',
                                    cuentaBancaria: tercero.cuentaBancaria || '',
                                    salarioBase: tercero.salarioBase?.toString() || '',
                                    cargo: tercero.cargo || '',
                                    estado: tercero.estado,
                                  });
                                  setShowForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(tercero.id)}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No se encontraron terceros
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-foreground">
                {editingTercero ? 'Editar Tercero' : 'Agregar Tercero'}
              </h4>
              <Button variant="ghost" onClick={() => {
                setShowForm(false);
                setEditingTercero(null);
                resetForm();
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
                  <Select value={formData.tipo} onValueChange={(value: 'cliente' | 'proveedor' | 'empleado' | 'freelancer') => setFormData({...formData, tipo: value})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="proveedor">Proveedor</SelectItem>
                      <SelectItem value="empleado">Empleado</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Nombre</label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    required
                    placeholder="Nombre completo o razón social"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">NIT</label>
                  <Input
                    value={formData.nit}
                    onChange={(e) => setFormData({...formData, nit: e.target.value})}
                    placeholder="Número de identificación"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Teléfono</label>
                  <Input
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                    placeholder="3001234567"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Dirección</label>
                  <Input
                    value={formData.direccion}
                    onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                    placeholder="Calle 123, Ciudad"
                  />
                </div>

                {formData.tipo === 'proveedor' && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Categoría</label>
                    <Input
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      placeholder="Ej: Servicios, Productos"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Cuenta Bancaria</label>
                  <Input
                    value={formData.cuentaBancaria}
                    onChange={(e) => setFormData({...formData, cuentaBancaria: e.target.value})}
                    placeholder="Número de cuenta"
                  />
                </div>

                {formData.tipo === 'empleado' && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Salario Base</label>
                      <Input
                        type="number"
                        value={formData.salarioBase}
                        onChange={(e) => setFormData({...formData, salarioBase: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Cargo</label>
                      <Input
                        value={formData.cargo}
                        onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                        placeholder="Ej: Desarrollador, Gerente"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Estado</label>
                  <Select value={formData.estado} onValueChange={(value: 'activo' | 'inactivo') => setFormData({...formData, estado: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingTercero(null);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingTercero ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Actualizar Tercero
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Tercero
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}