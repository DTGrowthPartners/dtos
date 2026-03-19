import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Mail, Phone, MapPin, Edit, Trash2, Building2, Grid3x3, LayoutGrid, Columns3, Eye, EyeOff, List, Upload, Power, Users, ChevronDown, ChevronRight, UserCheck, Briefcase, ImagePlus, X, ArrowDownToLine, DollarSign, Check, FileText, Calendar, ArrowLeft, Download, Receipt, MoreVertical, Globe, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { convertImageToBase64 } from '@/lib/imageService';
import ClientServicesManager from '@/components/clients/ClientServicesManager';

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

interface Organizacion {
  id: string;
  nombre: string;
  nit?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  estado: string;
  terceros: Tercero[];
}

interface Tercero {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  telefonoCodigo: string;
  esProspecto: boolean;
  esCliente: boolean;
  esProveedor: boolean;
  esEmpleado: boolean;
  organizacionId?: string;
  organizacion?: Organizacion;
  cargo?: string;
  estado: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  paidAmount: number;
  fecha: string;
  concepto?: string;
  servicio?: string;
  status: string;
  paidAt?: string;
  createdAt: string;
  payments?: { id: string; amount: number; paidAt: string; method?: string }[];
}

type ViewMode = '1' | '2' | '3' | 'list';
type StatusFilter = 'all' | 'active' | 'inactive';

interface CRMProspect {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  phoneCountryCode?: string;
  logo?: string;
  estimatedValue?: number;
  stage?: { name: string; color: string; isWon?: boolean };
}

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3');
  const [hiddenClients, setHiddenClients] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [activeTab, setActiveTab] = useState('empresas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [isImportCRMOpen, setIsImportCRMOpen] = useState(false);
  const [crmProspects, setCrmProspects] = useState<CRMProspect[]>([]);
  const [loadingCRM, setLoadingCRM] = useState(false);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());
  // Client Profile (full page)
  const [profileClient, setProfileClient] = useState<Client | null>(null);
  const [profileInvoices, setProfileInvoices] = useState<Invoice[]>([]);
  const [profileTab, setProfileTab] = useState('info');
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    nit: '',
    phone: '',
    address: '',
    logo: '',
  });

  useEffect(() => {
    fetchClients();
    fetchTerceros();
  }, []);

  const fetchClients = async () => {
    try {
      const data = await apiClient.get<Client[]>('/api/clients');
      setClients(data);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los clientes', variant: 'destructive' });
    }
  };

  const fetchTerceros = async () => {
    try {
      const data = await apiClient.get<Tercero[]>('/api/terceros?esCliente=true');
      setTerceros(data);
      const orgsData = await apiClient.get<Organizacion[]>('/api/terceros/organizaciones/list');
      setOrganizaciones(orgsData.filter(org => org.terceros?.some(t => t.esCliente)));
    } catch (error) {
      console.error('Error fetching terceros:', error);
    }
  };

  const fetchCRMProspects = async () => {
    setLoadingCRM(true);
    try {
      const data = await apiClient.get<CRMProspect[]>('/api/crm/deals');
      const existingEmails = new Set(clients.map(c => c.email.toLowerCase()));
      setCrmProspects(data.filter(p => p.email && !existingEmails.has(p.email.toLowerCase())));
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los prospectos del CRM', variant: 'destructive' });
    } finally {
      setLoadingCRM(false);
    }
  };

  const handleOpenImportCRM = () => {
    setSelectedProspects(new Set());
    setIsImportCRMOpen(true);
    fetchCRMProspects();
  };

  const toggleProspectSelection = (id: string) => {
    setSelectedProspects(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleImportSelectedProspects = async () => {
    if (selectedProspects.size === 0) return;
    setIsLoading(true);
    let successCount = 0, errorCount = 0;
    for (const pid of selectedProspects) {
      const p = crmProspects.find(x => x.id === pid);
      if (!p) continue;
      try {
        await apiClient.post('/api/clients', { name: p.company || p.name, email: p.email || '', phone: p.phone ? `${p.phoneCountryCode || ''} ${p.phone}`.trim() : '', logo: p.logo || '', status: 'active' });
        successCount++;
      } catch { errorCount++; }
    }
    toast({ title: 'Importación completada', description: `${successCount} clientes importados${errorCount > 0 ? `, ${errorCount} errores` : ''}` });
    setIsImportCRMOpen(false);
    setSelectedProspects(new Set());
    fetchClients();
    setIsLoading(false);
  };

  const openClientProfile = async (client: Client) => {
    setProfileClient(client);
    setProfileTab('info');
    setLoadingInvoices(true);
    try {
      const allInvoices = await apiClient.get<Invoice[]>('/api/invoices');
      setProfileInvoices(allInvoices.filter(inv => inv.clientName?.toLowerCase() === client.name.toLowerCase()));
    } catch { setProfileInvoices([]); }
    finally { setLoadingInvoices(false); }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/invoices/${invoiceId}/download`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Error');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cuenta_cobro_${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error', description: 'No se pudo descargar la cuenta de cobro', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pagada': return 'bg-green-500/20 text-green-400';
      case 'parcial': return 'bg-yellow-500/20 text-yellow-400';
      case 'pendiente': return 'bg-red-500/20 text-red-400';
      case 'enviada': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const toggleOrgExpanded = (orgId: string) => {
    setExpandedOrgs(prev => { const n = new Set(prev); n.has(orgId) ? n.delete(orgId) : n.add(orgId); return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingClient) {
        await apiClient.put(`/api/clients/${editingClient.id}`, formData);
        toast({ title: 'Cliente actualizado', description: 'El cliente se actualizó correctamente' });
      } else {
        await apiClient.post('/api/clients', formData);
        toast({ title: 'Cliente creado', description: 'El cliente se creó correctamente' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error al guardar', variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({ name: client.name, email: client.email, nit: client.nit || '', phone: client.phone || '', address: client.address || '', logo: client.logo || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiClient.delete(`/api/clients/${id}`);
      toast({ title: 'Cliente eliminado', description: `${name} se eliminó correctamente` });
      fetchClients();
      if (profileClient?.id === id) setProfileClient(null);
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar el cliente', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (client: Client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      await apiClient.put(`/api/clients/${client.id}`, { name: client.name, email: client.email, nit: client.nit, phone: client.phone, address: client.address, status: newStatus });
      toast({ title: 'Estado actualizado', description: `${client.name} ahora está ${newStatus === 'active' ? 'activo' : 'inactivo'}` });
      fetchClients();
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', nit: '', phone: '', address: '', logo: '' });
    setEditingClient(null);
  };

  const handleImportClients = async () => {
    if (!confirm('¿Deseas importar clientes desde el archivo de migración?')) return;
    try {
      const response = await fetch('/data/clientes-migracion.json');
      const data = await response.json();
      let successCount = 0, errorCount = 0;
      for (const clientData of data.clientes) {
        try { await apiClient.post('/api/clients', clientData); successCount++; } catch { errorCount++; }
      }
      toast({ title: 'Importación completada', description: `${successCount} clientes importados, ${errorCount} errores` });
      fetchClients();
    } catch {
      toast({ title: 'Error', description: 'No se pudieron importar los clientes', variant: 'destructive' });
    }
  };

  const toggleClientVisibility = (clientId: string) => {
    setHiddenClients(prev => { const n = new Set(prev); n.has(clientId) ? n.delete(clientId) : n.add(clientId); return n; });
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.nit || '').toLowerCase().includes(searchQuery.toLowerCase());
      const isHidden = hiddenClients.has(client.id);
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      if (showHidden) return matchesSearch && matchesStatus;
      return matchesSearch && !isHidden && matchesStatus;
    });
  }, [clients, searchQuery, hiddenClients, showHidden, statusFilter]);

  const activeCount = clients.filter(c => c.status === 'active').length;
  const inactiveCount = clients.filter(c => c.status === 'inactive').length;

  const getGridColumns = () => {
    switch (viewMode) {
      case '1': return 'grid-cols-1';
      case '2': return 'grid-cols-1 sm:grid-cols-2';
      case '3': return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      default: return '';
    }
  };

  const filteredTerceros = terceros.filter(t =>
    t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const tercerosSinOrg = filteredTerceros.filter(t => !t.organizacionId);

  // ════════════════════════════════════════════════════════
  //  CLIENT PROFILE VIEW (Full Page)
  // ════════════════════════════════════════════════════════
  if (profileClient) {
    const totalFacturado = profileInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPagado = profileInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const pendiente = totalFacturado - totalPagado;
    const facturasPagadas = profileInvoices.filter(i => i.status === 'pagada').length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back Button */}
        <button onClick={() => setProfileClient(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver a Clientes
        </button>

        {/* Profile Header */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <img
                src={profileClient.logo}
                alt={profileClient.name}
                className="h-24 w-24 md:h-28 md:w-28 rounded-2xl object-contain bg-background p-3 border border-border shadow-sm"
                onError={(e) => { e.currentTarget.src = '/img/logo.png'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{profileClient.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        profileClient.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        <Power className="h-3 w-3" />
                        {profileClient.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                      {profileClient.nit && (
                        <span className="text-sm text-muted-foreground">NIT: {profileClient.nit}</span>
                      )}
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">
                        Cliente desde {new Date(profileClient.createdAt).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { handleEdit(profileClient); }}>
                      <Edit className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(profileClient)}>
                      <Power className="h-4 w-4 mr-1" />
                      {profileClient.status === 'active' ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </div>

                {/* Contact Info Row */}
                <div className="flex flex-wrap gap-4 mt-4">
                  {profileClient.email && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {profileClient.email}
                    </span>
                  )}
                  {profileClient.phone && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {profileClient.phone}
                    </span>
                  )}
                  {profileClient.address && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {profileClient.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          {!loadingInvoices && (
            <div className="grid grid-cols-2 md:grid-cols-4 border-t border-border">
              <div className="p-4 md:p-5 text-center border-r border-border">
                <p className="text-2xl md:text-3xl font-bold text-foreground">{profileInvoices.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Facturas ({facturasPagadas} pagadas)</p>
              </div>
              <div className="p-4 md:p-5 text-center md:border-r border-border">
                <p className="text-2xl md:text-3xl font-bold text-green-400">${totalPagado.toLocaleString('es-CO')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Pagado</p>
              </div>
              <div className="p-4 md:p-5 text-center border-r border-t md:border-t-0 border-border">
                <p className="text-2xl md:text-3xl font-bold text-foreground">${totalFacturado.toLocaleString('es-CO')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Facturado</p>
              </div>
              <div className="p-4 md:p-5 text-center border-t md:border-t-0 border-border">
                <p className={`text-2xl md:text-3xl font-bold ${pendiente > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  ${pendiente.toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Pendiente</p>
              </div>
            </div>
          )}
        </div>

        {/* Profile Tabs */}
        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList>
            <TabsTrigger value="info" className="gap-2">
              <Building2 className="h-4 w-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="facturas" className="gap-2">
              <Receipt className="h-4 w-4" />
              Facturas ({profileInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="servicios" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Servicios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Info */}
          <TabsContent value="info" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Datos de la empresa
                </h3>
                {[
                  { icon: Mail, label: 'Email', value: profileClient.email },
                  { icon: Phone, label: 'Teléfono', value: profileClient.phone },
                  { icon: MapPin, label: 'Dirección', value: profileClient.address },
                  { icon: FileText, label: 'NIT / RUT', value: profileClient.nit },
                  { icon: Calendar, label: 'Cliente desde', value: new Date(profileClient.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].filter(item => item.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Resumen financiero
                </h3>
                {loadingInvoices ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {profileInvoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${
                              inv.status === 'pagada' ? 'bg-green-400' : inv.status === 'parcial' ? 'bg-yellow-400' : 'bg-red-400'
                            }`} />
                            <span className="truncate text-muted-foreground">#{inv.invoiceNumber}</span>
                          </div>
                          <span className="font-medium text-foreground flex-shrink-0">${inv.totalAmount.toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                      {profileInvoices.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Sin facturas</p>
                      )}
                    </div>
                    {profileInvoices.length > 5 && (
                      <button onClick={() => setProfileTab('facturas')} className="text-sm text-primary hover:underline w-full text-center">
                        Ver todas las facturas ({profileInvoices.length})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Facturas */}
          <TabsContent value="facturas" className="mt-4">
            <div className="rounded-xl border border-border bg-card">
              {loadingInvoices ? (
                <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>
              ) : profileInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">No hay facturas para este cliente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Factura</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profileInvoices.map(inv => (
                      <TableRow key={inv.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">#{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(inv.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">{inv.concepto || '-'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(inv.status)}`}>
                            {inv.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">${inv.totalAmount.toLocaleString('es-CO')}</TableCell>
                        <TableCell className="text-right text-green-400">${inv.paidAmount.toLocaleString('es-CO')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(inv.id)} className="h-8 w-8 p-0">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Tab: Servicios */}
          <TabsContent value="servicios" className="mt-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <ClientServicesManager client={profileClient} onUpdate={() => {}} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  //  CLIENT LIST VIEW
  // ════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">{clients.length} empresas · {activeCount} activos</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'empresas' && (
            <>
              <Button variant="outline" onClick={handleImportClients} className="w-full md:w-auto">
                <Upload className="h-4 w-4 mr-2" /> Importar
              </Button>
              <Button variant="outline" onClick={handleOpenImportCRM} className="w-full md:w-auto">
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Desde CRM
              </Button>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:w-auto">
            <TabsTrigger value="empresas" className="flex items-center gap-2 whitespace-nowrap">
              <Building2 className="h-4 w-4" />
              Empresas ({clients.length})
            </TabsTrigger>
            <TabsTrigger value="contactos" className="flex items-center gap-2 whitespace-nowrap">
              <Users className="h-4 w-4" />
              Contactos ({terceros.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Empresas */}
        <TabsContent value="empresas" className="space-y-4 mt-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, email o NIT..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
            </div>
            <div className="flex gap-2">
              {/* Status filter */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {[
                  { value: 'all' as StatusFilter, label: `Todos (${clients.length})` },
                  { value: 'active' as StatusFilter, label: `Activos (${activeCount})` },
                  { value: 'inactive' as StatusFilter, label: `Inactivos (${inactiveCount})` },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      statusFilter === f.value ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
                <ToggleGroupItem value="list"><List className="h-4 w-4" /></ToggleGroupItem>
                <ToggleGroupItem value="2"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
                <ToggleGroupItem value="3"><Grid3x3 className="h-4 w-4" /></ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredClients.length} de {clients.length} empresas
          </p>

          {/* List View */}
          {viewMode === 'list' ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>NIT/RUT</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell>
                        <img src={client.logo} alt={client.name} className="h-8 w-8 rounded-lg object-contain bg-muted p-1" onError={(e) => { e.currentTarget.src = '/img/logo.png'; }} />
                      </TableCell>
                      <TableCell>
                        <button onClick={() => openClientProfile(client)} className="font-medium text-left hover:text-primary transition-colors hover:underline">
                          {client.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{client.email}</TableCell>
                      <TableCell className="text-muted-foreground">{client.nit || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{client.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {client.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openClientProfile(client)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(client)}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(client)}>
                              <Power className="h-4 w-4 mr-2" /> {client.status === 'active' ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(client.id, client.name)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className={`grid gap-4 ${getGridColumns()}`}>
              {filteredClients.map((client) => (
                <Card key={client.id} className="hover:border-primary/30 transition-all group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <img src={client.logo} alt={client.name} className="h-12 w-12 rounded-xl object-contain bg-muted p-2 flex-shrink-0"
                        onError={(e) => { e.currentTarget.src = '/img/logo.png'; }} />
                      <div className="flex-1 min-w-0">
                        <button onClick={() => openClientProfile(client)} className="font-semibold text-base text-left hover:text-primary transition-colors truncate block w-full">
                          {client.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            client.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {client.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                          {client.nit && <span className="text-xs text-muted-foreground">{client.nit}</span>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openClientProfile(client)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(client)}>
                            <Power className="h-4 w-4 mr-2" /> {client.status === 'active' ? 'Desactivar' : 'Activar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(client.id, client.name)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 pb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filteredClients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No se encontraron empresas</h3>
              <p className="text-muted-foreground">{searchQuery ? 'Intenta con otra búsqueda' : 'Crea tu primera empresa'}</p>
            </div>
          )}
        </TabsContent>

        {/* Tab: Contactos */}
        <TabsContent value="contactos" className="space-y-4 mt-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar contactos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
          </div>

          {organizaciones.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Por Organización</h3>
              {organizaciones.map((org) => {
                const clientesEnOrg = org.terceros?.filter(t => t.esCliente) || [];
                if (clientesEnOrg.length === 0) return null;
                return (
                  <Collapsible key={org.id} open={expandedOrgs.has(org.id)} onOpenChange={() => toggleOrgExpanded(org.id)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedOrgs.has(org.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <Building2 className="h-5 w-5 text-primary" />
                              <div>
                                <CardTitle className="text-base">{org.nombre}</CardTitle>
                                {org.nit && <p className="text-xs text-muted-foreground">NIT: {org.nit}</p>}
                              </div>
                            </div>
                            <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{clientesEnOrg.length}</Badge>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <div className="space-y-2 border-t pt-3">
                            {clientesEnOrg.map((tercero) => (
                              <div key={tercero.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{tercero.nombre}</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      {tercero.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{tercero.email}</span>}
                                      {tercero.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{tercero.telefonoCodigo} {tercero.telefono}</span>}
                                    </div>
                                  </div>
                                </div>
                                {tercero.cargo && <Badge variant="outline" className="text-xs">{tercero.cargo}</Badge>}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {tercerosSinOrg.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Sin Organización</h3>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {tercerosSinOrg.map((tercero) => (
                  <Card key={tercero.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{tercero.nombre}</p>
                          {tercero.email && <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="h-3 w-3" />{tercero.email}</p>}
                          {tercero.telefono && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{tercero.telefonoCodigo} {tercero.telefono}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {terceros.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No hay contactos clientes</h3>
              <p className="text-muted-foreground">Los prospectos convertidos a clientes aparecerán aquí</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogDescription>{editingClient ? 'Actualiza la información del cliente' : 'Completa los datos del nuevo cliente'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50 flex-shrink-0">
                  {formData.logo ? (
                    <>
                      <img src={formData.logo} alt="Logo" className="h-full w-full object-contain p-1" />
                      <button type="button" onClick={() => setFormData({ ...formData, logo: '' })} className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-destructive/90">
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full hover:bg-muted/80 transition-colors">
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Logo</span>
                      <input type="file" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) { try { setFormData({ ...formData, logo: await convertImageToBase64(file) }); } catch {} }
                      }} className="hidden" disabled={isLoading} />
                    </label>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input id="name" placeholder="Nombre del cliente" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={isLoading} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" placeholder="cliente@ejemplo.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nit">NIT/RUT</Label>
                <Input id="nit" placeholder="123456789-0" value={formData.nit} onChange={(e) => setFormData({ ...formData, nit: e.target.value })} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" type="tel" placeholder="+57 300 123 4567" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Textarea id="address" placeholder="Dirección completa" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={isLoading} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} disabled={isLoading}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? 'Guardando...' : editingClient ? 'Actualizar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import from CRM Dialog */}
      <Dialog open={isImportCRMOpen} onOpenChange={setIsImportCRMOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Importar desde CRM</DialogTitle>
            <DialogDescription>Selecciona los prospectos que deseas convertir en clientes</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {loadingCRM ? (
              <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : crmProspects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay prospectos disponibles para importar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crmProspects.map((prospect) => (
                  <div key={prospect.id} onClick={() => toggleProspectSelection(prospect.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedProspects.has(prospect.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedProspects.has(prospect.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                        {selectedProspects.has(prospect.id) && <Check className="h-3 w-3" />}
                      </div>
                      {prospect.logo ? <img src={prospect.logo} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Building2 className="h-5 w-5 text-muted-foreground" /></div>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{prospect.company || prospect.name}</p>
                          {prospect.stage && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: prospect.stage.color + '20', color: prospect.stage.color }}>{prospect.stage.name}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {prospect.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prospect.email}</span>}
                          {prospect.estimatedValue && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{prospect.estimatedValue.toLocaleString('es-CO')}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">{selectedProspects.size} seleccionado(s)</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsImportCRMOpen(false)}>Cancelar</Button>
                <Button onClick={handleImportSelectedProspects} disabled={selectedProspects.size === 0 || isLoading}>
                  {isLoading ? 'Importando...' : `Importar (${selectedProspects.size})`}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
