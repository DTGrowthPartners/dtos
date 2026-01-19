import { useState, useEffect } from 'react';
import {
  Plus, Search, Mail, Phone, Building2, Users, User,
  ChevronDown, ChevronRight, Edit, Trash2, UserPlus,
  Briefcase, UserCheck, Truck, BadgeCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

interface Organizacion {
  id: string;
  nombre: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  estado: string;
  terceros: Tercero[];
  _count?: { terceros: number };
}

// Cliente de la vista Clientes (empresas)
interface Client {
  id: string;
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo: string;
  status: string;
  terceros: Tercero[];
  _count?: { terceros: number };
}

interface Tercero {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  telefonoCodigo: string;
  direccion?: string;
  documento?: string;
  esProspecto: boolean;
  esCliente: boolean;
  esProveedor: boolean;
  esEmpleado: boolean;
  organizacionId?: string;
  organizacion?: Organizacion;
  clientId?: string;
  client?: Client;
  categoriaProveedor?: string;
  cargo?: string;
  estado: string;
  notas?: string;
  tags: string[];
  deals?: { id: string; stageId: string; estimatedValue?: number }[];
}

interface Estadisticas {
  totalTerceros: number;
  prospectos: number;
  clientes: number;
  proveedores: number;
  empleados: number;
  organizaciones: number;
}

export default function Terceros() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [clients, setClients] = useState<Client[]>([]); // Clientes de la vista Clientes
  const [tercerosSinOrg, setTercerosSinOrg] = useState<Tercero[]>([]);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('clientes'); // Cambiar tab default a clientes

  // Dialogs
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isTerceroDialogOpen, setIsTerceroDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organizacion | null>(null);
  const [editingTercero, setEditingTercero] = useState<Tercero | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Estado para crear organizacion inline desde el modal de tercero
  const [isCreatingOrgInline, setIsCreatingOrgInline] = useState(false);
  const [inlineOrgData, setInlineOrgData] = useState({ nombre: '', nit: '' });

  const { toast } = useToast();

  // Form data
  const [orgFormData, setOrgFormData] = useState({
    nombre: '',
    nit: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  const [terceroFormData, setTerceroFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    telefonoCodigo: '+57',
    documento: '',
    esProspecto: false,
    esCliente: false,
    esProveedor: false,
    esEmpleado: false,
    organizacionId: '',
    clientId: '', // Nuevo: referencia a Cliente
    categoriaProveedor: '',
    cargo: '',
    notas: '',
  });

  useEffect(() => {
    fetchData();
  }, [filterType]);

  const fetchData = async () => {
    try {
      const [orgsData, clientsData, tercerosData, statsData] = await Promise.all([
        apiClient.get<Organizacion[]>('/api/terceros/organizaciones/list'),
        apiClient.get<Client[]>('/api/terceros/clients/list'),
        apiClient.get<Tercero[]>(`/api/terceros?${buildTerceroFilters()}`),
        apiClient.get<Estadisticas>('/api/terceros/estadisticas'),
      ]);

      setOrganizaciones(orgsData);
      setClients(clientsData);
      // Terceros sin cliente ni organizacion
      setTercerosSinOrg(tercerosData.filter(t => !t.clientId && !t.organizacionId));
      setEstadisticas(statsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos',
        variant: 'destructive',
      });
    }
  };

  const buildTerceroFilters = () => {
    const params = new URLSearchParams();
    if (filterType === 'prospectos') params.append('esProspecto', 'true');
    if (filterType === 'clientes') params.append('esCliente', 'true');
    if (filterType === 'proveedores') params.append('esProveedor', 'true');
    if (filterType === 'empleados') params.append('esEmpleado', 'true');
    if (searchQuery) params.append('search', searchQuery);
    return params.toString();
  };

  const handleSearch = () => {
    fetchData();
  };

  // Organizacion handlers
  const handleSubmitOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingOrg) {
        await apiClient.put(`/api/terceros/organizaciones/${editingOrg.id}`, orgFormData);
        toast({ title: 'Organizacion actualizada' });
      } else {
        await apiClient.post('/api/terceros/organizaciones', orgFormData);
        toast({ title: 'Organizacion creada' });
      }
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la organizacion',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrg = (org: Organizacion) => {
    setEditingOrg(org);
    setOrgFormData({
      nombre: org.nombre,
      nit: org.nit || '',
      direccion: org.direccion || '',
      telefono: org.telefono || '',
      email: org.email || '',
    });
    setIsOrgDialogOpen(true);
  };

  const handleDeleteOrg = async (id: string) => {
    if (!confirm('¿Eliminar esta organizacion?')) return;
    try {
      await apiClient.delete(`/api/terceros/organizaciones/${id}`);
      toast({ title: 'Organizacion eliminada' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  };

  const resetOrgForm = () => {
    setOrgFormData({ nombre: '', nit: '', direccion: '', telefono: '', email: '' });
    setEditingOrg(null);
  };

  // Crear organizacion inline desde el modal de tercero
  const handleCreateOrgInline = async () => {
    if (!inlineOrgData.nombre.trim()) {
      toast({ title: 'El nombre de la organizacion es requerido', variant: 'destructive' });
      return;
    }

    try {
      const newOrg = await apiClient.post<Organizacion>('/api/terceros/organizaciones', {
        nombre: inlineOrgData.nombre,
        nit: inlineOrgData.nit || undefined,
      });

      // Agregar la nueva org a la lista local
      setOrganizaciones(prev => [...prev, newOrg]);

      // Asignar la nueva org al tercero
      setTerceroFormData(prev => ({ ...prev, organizacionId: newOrg.id, clientId: '' }));

      // Limpiar y cerrar el modo inline
      setInlineOrgData({ nombre: '', nit: '' });
      setIsCreatingOrgInline(false);

      toast({ title: 'Organizacion creada' });
    } catch (error) {
      toast({ title: 'Error al crear organizacion', variant: 'destructive' });
    }
  };

  // Tercero handlers
  const handleSubmitTercero = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const payload = {
      ...terceroFormData,
      organizacionId: terceroFormData.organizacionId || undefined,
      clientId: terceroFormData.clientId || undefined,
    };

    try {
      if (editingTercero) {
        await apiClient.put(`/api/terceros/${editingTercero.id}`, payload);
        toast({ title: 'Contacto actualizado' });
      } else {
        await apiClient.post('/api/terceros', payload);
        toast({ title: 'Contacto creado' });
      }
      setIsTerceroDialogOpen(false);
      resetTerceroForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el contacto',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTercero = (tercero: Tercero) => {
    setEditingTercero(tercero);
    setTerceroFormData({
      nombre: tercero.nombre,
      email: tercero.email || '',
      telefono: tercero.telefono || '',
      telefonoCodigo: tercero.telefonoCodigo || '+57',
      documento: tercero.documento || '',
      esProspecto: tercero.esProspecto,
      esCliente: tercero.esCliente,
      esProveedor: tercero.esProveedor,
      esEmpleado: tercero.esEmpleado,
      organizacionId: tercero.organizacionId || '',
      clientId: tercero.clientId || '',
      categoriaProveedor: tercero.categoriaProveedor || '',
      cargo: tercero.cargo || '',
      notas: tercero.notas || '',
    });
    setIsTerceroDialogOpen(true);
  };

  const handleDeleteTercero = async (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    try {
      await apiClient.delete(`/api/terceros/${id}`);
      toast({ title: 'Contacto eliminado' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  };

  const handleAddTerceroToOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    resetTerceroForm();
    setTerceroFormData(prev => ({ ...prev, organizacionId: orgId }));
    setIsTerceroDialogOpen(true);
  };

  const handleAddTerceroToClient = (clientId: string) => {
    setSelectedClientId(clientId);
    resetTerceroForm();
    setTerceroFormData(prev => ({ ...prev, clientId: clientId }));
    setIsTerceroDialogOpen(true);
  };

  const resetTerceroForm = () => {
    setTerceroFormData({
      nombre: '',
      email: '',
      telefono: '',
      telefonoCodigo: '+57',
      documento: '',
      esProspecto: false,
      esCliente: false,
      esProveedor: false,
      esEmpleado: false,
      organizacionId: selectedOrgId || '',
      clientId: selectedClientId || '',
      categoriaProveedor: '',
      cargo: '',
      notas: '',
    });
    setEditingTercero(null);
    setSelectedOrgId(null);
    setSelectedClientId(null);
    setIsCreatingOrgInline(false);
    setInlineOrgData({ nombre: '', nit: '' });
  };

  const toggleOrgExpanded = (orgId: string) => {
    setExpandedOrgs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orgId)) {
        newSet.delete(orgId);
      } else {
        newSet.add(orgId);
      }
      return newSet;
    });
  };

  const getTerceroTypeBadges = (tercero: Tercero) => {
    const badges = [];
    if (tercero.esProspecto) badges.push({ label: 'Prospecto', color: 'bg-blue-100 text-blue-800' });
    if (tercero.esCliente) badges.push({ label: 'Cliente', color: 'bg-green-100 text-green-800' });
    if (tercero.esProveedor) badges.push({ label: 'Proveedor', color: 'bg-purple-100 text-purple-800' });
    if (tercero.esEmpleado) badges.push({ label: 'Empleado', color: 'bg-orange-100 text-orange-800' });
    return badges;
  };

  const filteredOrganizaciones = organizaciones.filter(org =>
    org.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terceros</h1>
          <p className="text-muted-foreground">Gestiona organizaciones y contactos</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetOrgForm();
              setIsOrgDialogOpen(true);
            }}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Nueva Organizacion
          </Button>
          <Button
            onClick={() => {
              resetTerceroForm();
              setIsTerceroDialogOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      {/* Stats */}
      {estadisticas && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.totalTerceros}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.prospectos}</p>
                <p className="text-xs text-muted-foreground">Prospectos</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.clientes}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.proveedores}</p>
                <p className="text-xs text-muted-foreground">Proveedores</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.empleados}</p>
                <p className="text-xs text-muted-foreground">Empleados</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-2xl font-bold">{estadisticas.organizaciones}</p>
                <p className="text-xs text-muted-foreground">Organizaciones</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o telefono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="prospectos">Prospectos</SelectItem>
            <SelectItem value="clientes">Clientes</SelectItem>
            <SelectItem value="proveedores">Proveedores</SelectItem>
            <SelectItem value="empleados">Empleados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:w-auto">
            <TabsTrigger value="clientes" className="whitespace-nowrap">
              <Users className="h-4 w-4 mr-2" />
              Clientes ({clients.length})
            </TabsTrigger>
            <TabsTrigger value="organizaciones" className="whitespace-nowrap">
              <Building2 className="h-4 w-4 mr-2" />
              Organizaciones ({filteredOrganizaciones.length})
            </TabsTrigger>
            <TabsTrigger value="independientes" className="whitespace-nowrap">
              <User className="h-4 w-4 mr-2" />
              Sin Empresa ({tercerosSinOrg.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Clientes (empresas de la vista Clientes) */}
        <TabsContent value="clientes" className="space-y-4 mt-4">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay clientes</h3>
              <p className="text-muted-foreground">Los clientes se crean desde la vista Clientes</p>
            </div>
          ) : (
            clients.map((client) => (
              <Card key={client.id}>
                <Collapsible
                  open={expandedOrgs.has(client.id)}
                  onOpenChange={() => toggleOrgExpanded(client.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-3 hover:opacity-80">
                        {expandedOrgs.has(client.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <img
                          src={client.logo}
                          alt={client.name}
                          className="h-8 w-8 rounded object-contain bg-muted p-1"
                          onError={(e) => { e.currentTarget.src = '/img/logo.png'; }}
                        />
                        <div className="text-left">
                          <CardTitle className="text-lg">{client.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {client._count?.terceros || client.terceros?.length || 0} contactos
                            {client.nit && ` • NIT: ${client.nit}`}
                          </p>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddTerceroToClient(client.id)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Agregar Contacto
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      {client.terceros?.length > 0 ? (
                        <div className="space-y-2">
                          {client.terceros.map((tercero) => (
                            <div
                              key={tercero.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{tercero.nombre}</p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {tercero.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {tercero.email}
                                      </span>
                                    )}
                                    {tercero.telefono && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {tercero.telefonoCodigo} {tercero.telefono}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getTerceroTypeBadges(tercero).map((badge, i) => (
                                  <Badge key={i} variant="secondary" className={badge.color}>
                                    {badge.label}
                                  </Badge>
                                ))}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditTercero(tercero)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => handleDeleteTercero(tercero.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No hay contactos asociados a este cliente
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="organizaciones" className="space-y-4 mt-4">
          {filteredOrganizaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay organizaciones</h3>
              <p className="text-muted-foreground">Crea tu primera organizacion</p>
            </div>
          ) : (
            filteredOrganizaciones.map((org) => (
              <Card key={org.id}>
                <Collapsible
                  open={expandedOrgs.has(org.id)}
                  onOpenChange={() => toggleOrgExpanded(org.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-3 hover:opacity-80">
                        {expandedOrgs.has(org.id) ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                        <div className="text-left">
                          <CardTitle className="text-lg">{org.nombre}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {org._count?.terceros || org.terceros?.length || 0} contactos
                            {org.nit && ` · NIT: ${org.nit}`}
                          </p>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddTerceroToOrg(org.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrg(org)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrg(org.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {org.terceros && org.terceros.length > 0 ? (
                        <div className="space-y-2 mt-4 pl-8">
                          {org.terceros.map((tercero) => (
                            <div
                              key={tercero.id}
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{tercero.nombre}</p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {tercero.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {tercero.email}
                                      </span>
                                    )}
                                    {tercero.telefono && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {tercero.telefonoCodigo} {tercero.telefono}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getTerceroTypeBadges(tercero).map((badge, idx) => (
                                  <Badge key={idx} variant="secondary" className={badge.color}>
                                    {badge.label}
                                  </Badge>
                                ))}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTercero(tercero)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTercero(tercero.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-4 pl-8">
                          No hay contactos en esta organizacion
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="independientes" className="space-y-4 mt-4">
          {tercerosSinOrg.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay contactos independientes</h3>
              <p className="text-muted-foreground">Todos los contactos estan asociados a organizaciones</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tercerosSinOrg.map((tercero) => (
                <Card key={tercero.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-base">{tercero.nombre}</CardTitle>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getTerceroTypeBadges(tercero).map((badge, idx) => (
                              <Badge key={idx} variant="secondary" className={`text-xs ${badge.color}`}>
                                {badge.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTercero(tercero)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTercero(tercero.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {tercero.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{tercero.email}</span>
                      </div>
                    )}
                    {tercero.telefono && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{tercero.telefonoCodigo} {tercero.telefono}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Organizacion Dialog */}
      <Dialog open={isOrgDialogOpen} onOpenChange={setIsOrgDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingOrg ? 'Editar Organizacion' : 'Nueva Organizacion'}</DialogTitle>
            <DialogDescription>
              {editingOrg ? 'Actualiza los datos de la organizacion' : 'Crea una nueva organizacion'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitOrg}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-nombre">Nombre *</Label>
                <Input
                  id="org-nombre"
                  placeholder="Nombre de la organizacion"
                  value={orgFormData.nombre}
                  onChange={(e) => setOrgFormData({ ...orgFormData, nombre: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-nit">NIT</Label>
                <Input
                  id="org-nit"
                  placeholder="123456789-0"
                  value={orgFormData.nit}
                  onChange={(e) => setOrgFormData({ ...orgFormData, nit: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Email</Label>
                <Input
                  id="org-email"
                  type="email"
                  placeholder="contacto@empresa.com"
                  value={orgFormData.email}
                  onChange={(e) => setOrgFormData({ ...orgFormData, email: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-telefono">Telefono</Label>
                <Input
                  id="org-telefono"
                  placeholder="3001234567"
                  value={orgFormData.telefono}
                  onChange={(e) => setOrgFormData({ ...orgFormData, telefono: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-direccion">Direccion</Label>
                <Input
                  id="org-direccion"
                  placeholder="Direccion completa"
                  value={orgFormData.direccion}
                  onChange={(e) => setOrgFormData({ ...orgFormData, direccion: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOrgDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : editingOrg ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tercero Dialog */}
      <Dialog open={isTerceroDialogOpen} onOpenChange={setIsTerceroDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTercero ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
            <DialogDescription>
              {editingTercero ? 'Actualiza los datos del contacto' : 'Agrega un nuevo contacto'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTercero}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="tercero-nombre">Nombre *</Label>
                <Input
                  id="tercero-nombre"
                  placeholder="Nombre completo"
                  value={terceroFormData.nombre}
                  onChange={(e) => setTerceroFormData({ ...terceroFormData, nombre: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Asociar a</Label>
                <Tabs
                  value={terceroFormData.clientId ? 'cliente' : terceroFormData.organizacionId ? 'organizacion' : 'ninguno'}
                  onValueChange={(val) => {
                    if (val === 'ninguno') {
                      setTerceroFormData({ ...terceroFormData, clientId: '', organizacionId: '' });
                    } else if (val === 'cliente') {
                      setTerceroFormData({ ...terceroFormData, organizacionId: '' });
                    } else if (val === 'organizacion') {
                      setTerceroFormData({ ...terceroFormData, clientId: '' });
                    }
                    setIsCreatingOrgInline(false);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ninguno">Ninguno</TabsTrigger>
                    <TabsTrigger value="cliente">Cliente</TabsTrigger>
                    <TabsTrigger value="organizacion">Organizacion</TabsTrigger>
                  </TabsList>

                  <TabsContent value="cliente" className="mt-2">
                    <Select
                      value={terceroFormData.clientId || "none"}
                      onValueChange={(value) => setTerceroFormData({ ...terceroFormData, clientId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar cliente...</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>

                  <TabsContent value="organizacion" className="mt-2 space-y-2">
                    {!isCreatingOrgInline ? (
                      <>
                        <Select
                          value={terceroFormData.organizacionId || "none"}
                          onValueChange={(value) => setTerceroFormData({ ...terceroFormData, organizacionId: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar organizacion" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Seleccionar organizacion...</SelectItem>
                            {organizaciones.map((org) => (
                              <SelectItem key={org.id} value={org.id}>{org.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setIsCreatingOrgInline(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Crear nueva organizacion
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <p className="text-sm font-medium">Nueva Organizacion</p>
                        <Input
                          placeholder="Nombre de la organizacion *"
                          value={inlineOrgData.nombre}
                          onChange={(e) => setInlineOrgData({ ...inlineOrgData, nombre: e.target.value })}
                        />
                        <Input
                          placeholder="NIT (opcional)"
                          value={inlineOrgData.nit}
                          onChange={(e) => setInlineOrgData({ ...inlineOrgData, nit: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsCreatingOrgInline(false);
                              setInlineOrgData({ nombre: '', nit: '' });
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateOrgInline}
                          >
                            Crear y Asignar
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tercero-email">Email</Label>
                <Input
                  id="tercero-email"
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={terceroFormData.email}
                  onChange={(e) => setTerceroFormData({ ...terceroFormData, email: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>Codigo</Label>
                  <Select
                    value={terceroFormData.telefonoCodigo}
                    onValueChange={(value) => setTerceroFormData({ ...terceroFormData, telefonoCodigo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+57">+57</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                      <SelectItem value="+34">+34</SelectItem>
                      <SelectItem value="+52">+52</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="tercero-telefono">Telefono</Label>
                  <Input
                    id="tercero-telefono"
                    placeholder="3001234567"
                    value={terceroFormData.telefono}
                    onChange={(e) => setTerceroFormData({ ...terceroFormData, telefono: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de contacto</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esProspecto"
                      checked={terceroFormData.esProspecto}
                      onCheckedChange={(checked) => setTerceroFormData({ ...terceroFormData, esProspecto: !!checked })}
                    />
                    <Label htmlFor="esProspecto" className="text-sm font-normal">Prospecto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esCliente"
                      checked={terceroFormData.esCliente}
                      onCheckedChange={(checked) => setTerceroFormData({ ...terceroFormData, esCliente: !!checked })}
                    />
                    <Label htmlFor="esCliente" className="text-sm font-normal">Cliente</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esProveedor"
                      checked={terceroFormData.esProveedor}
                      onCheckedChange={(checked) => setTerceroFormData({ ...terceroFormData, esProveedor: !!checked })}
                    />
                    <Label htmlFor="esProveedor" className="text-sm font-normal">Proveedor</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="esEmpleado"
                      checked={terceroFormData.esEmpleado}
                      onCheckedChange={(checked) => setTerceroFormData({ ...terceroFormData, esEmpleado: !!checked })}
                    />
                    <Label htmlFor="esEmpleado" className="text-sm font-normal">Empleado</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tercero-cargo">Cargo</Label>
                <Input
                  id="tercero-cargo"
                  placeholder="Cargo o posicion"
                  value={terceroFormData.cargo}
                  onChange={(e) => setTerceroFormData({ ...terceroFormData, cargo: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tercero-documento">Documento</Label>
                <Input
                  id="tercero-documento"
                  placeholder="Cedula o documento"
                  value={terceroFormData.documento}
                  onChange={(e) => setTerceroFormData({ ...terceroFormData, documento: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTerceroDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : editingTercero ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
