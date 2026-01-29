import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Target,
  DollarSign,
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Mail,
  FileSpreadsheet,
  Upload,
  Eye,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ClientDetail {
  id: string;
  name: string;
  email: string;
  logo: string;
  portalUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  }>;
  portalCampaigns: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    budget: number;
    spent: number;
    impressions: number;
    clicks: number;
    conversions: number;
    startDate: string;
    endDate: string | null;
  }>;
  portalBudgets: Array<{
    id: string;
    month: number;
    year: number;
    budget: number;
    sales: number;
    leads: number;
    customers: number;
    notes: string | null;
  }>;
  portalServices: Array<{
    id: string;
    serviceId: string | null;
    service: { id: string; name: string; description: string | null; icon: string } | null;
    name: string;
    status: string;
    progress: number;
    startDate: string;
    endDate: string | null;
    notes: string | null;
  }>;
}

interface SystemService {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  price: number;
  currency: string;
}

interface ExcelFile {
  id: string;
  name: string;
  fileName: string;
  sheetNames: string[];
  description: string | null;
  createdAt: string;
  data?: Record<string, any[][]>;
}

interface ClientDataManagerProps {
  clientId: string;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function ClientDataManager({ clientId }: ClientDataManagerProps) {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campaigns');

  // Access dialog state
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [accessForm, setAccessForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });

  // Campaign form state
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    platform: 'facebook',
    status: 'active',
    budget: '',
    spent: '',
    impressions: '',
    clicks: '',
    conversions: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Budget form state
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [budgetForm, setBudgetForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    budget: '',
    sales: '',
    leads: '',
    customers: '',
    notes: '',
  });

  // Service form state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [systemServices, setSystemServices] = useState<SystemService[]>([]);
  const [serviceForm, setServiceForm] = useState({
    serviceId: '',
    name: '',
    status: 'active',
    progress: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Excel files state
  const [excelFiles, setExcelFiles] = useState<ExcelFile[]>([]);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelViewerOpen, setExcelViewerOpen] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<ExcelFile | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelForm, setExcelForm] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchClientDetail();
    fetchSystemServices();
    fetchExcelFiles();
  }, [clientId]);

  const fetchSystemServices = async () => {
    try {
      const response = await apiClient.get<SystemService[]>('/api/client-portal/services');
      setSystemServices(response);
    } catch (err) {
      console.error('Error fetching system services:', err);
    }
  };

  const fetchExcelFiles = async () => {
    try {
      const response = await apiClient.get<ExcelFile[]>(
        `/api/client-portal/admin/clients/${clientId}/excel`
      );
      setExcelFiles(response);
    } catch (err) {
      console.error('Error fetching excel files:', err);
    }
  };

  const fetchClientDetail = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ClientDetail>(
        `/api/client-portal/admin/clients/${clientId}`
      );
      setClient(response);
    } catch (err) {
      console.error('Error fetching client detail:', err);
      toast({
        title: 'Error',
        description: 'Error al cargar los datos del cliente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Campaign handlers
  const openCampaignDialog = (campaign?: any) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setCampaignForm({
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        budget: campaign.budget.toString(),
        spent: campaign.spent.toString(),
        impressions: campaign.impressions.toString(),
        clicks: campaign.clicks.toString(),
        conversions: campaign.conversions.toString(),
        startDate: campaign.startDate.split('T')[0],
        endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
        notes: campaign.notes || '',
      });
    } else {
      setEditingCampaign(null);
      setCampaignForm({
        name: '',
        platform: 'facebook',
        status: 'active',
        budget: '',
        spent: '0',
        impressions: '0',
        clicks: '0',
        conversions: '0',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: '',
      });
    }
    setCampaignDialogOpen(true);
  };

  const saveCampaign = async () => {
    try {
      const data = {
        name: campaignForm.name,
        platform: campaignForm.platform,
        status: campaignForm.status,
        budget: parseFloat(campaignForm.budget),
        spent: parseFloat(campaignForm.spent) || 0,
        impressions: parseInt(campaignForm.impressions) || 0,
        clicks: parseInt(campaignForm.clicks) || 0,
        conversions: parseInt(campaignForm.conversions) || 0,
        startDate: campaignForm.startDate,
        endDate: campaignForm.endDate || undefined,
        notes: campaignForm.notes || undefined,
      };

      if (editingCampaign) {
        await apiClient.put(`/api/client-portal/admin/campaigns/${editingCampaign.id}`, data);
        toast({ title: 'Campaña actualizada' });
      } else {
        await apiClient.post(`/api/client-portal/admin/clients/${clientId}/campaigns`, data);
        toast({ title: 'Campaña creada' });
      }
      setCampaignDialogOpen(false);
      fetchClientDetail();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar la campaña',
        variant: 'destructive',
      });
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('¿Eliminar esta campaña?')) return;
    try {
      await apiClient.delete(`/api/client-portal/admin/campaigns/${id}`);
      toast({ title: 'Campaña eliminada' });
      fetchClientDetail();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // Budget handlers
  const openBudgetDialog = (budget?: any) => {
    if (budget) {
      setEditingBudget(budget);
      setBudgetForm({
        month: budget.month,
        year: budget.year,
        budget: budget.budget.toString(),
        sales: budget.sales.toString(),
        leads: budget.leads.toString(),
        customers: budget.customers.toString(),
        notes: budget.notes || '',
      });
    } else {
      setEditingBudget(null);
      setBudgetForm({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        budget: '',
        sales: '0',
        leads: '0',
        customers: '0',
        notes: '',
      });
    }
    setBudgetDialogOpen(true);
  };

  const saveBudget = async () => {
    try {
      const data = {
        month: budgetForm.month,
        year: budgetForm.year,
        budget: parseFloat(budgetForm.budget),
        sales: parseFloat(budgetForm.sales) || 0,
        leads: parseInt(budgetForm.leads) || 0,
        customers: parseInt(budgetForm.customers) || 0,
        notes: budgetForm.notes || undefined,
      };

      await apiClient.post(`/api/client-portal/admin/clients/${clientId}/sales-budget`, data);
      toast({ title: 'Presupuesto guardado' });
      setBudgetDialogOpen(false);
      fetchClientDetail();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar el presupuesto',
        variant: 'destructive',
      });
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    try {
      await apiClient.delete(`/api/client-portal/admin/sales-budget/${id}`);
      toast({ title: 'Presupuesto eliminado' });
      fetchClientDetail();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // Service handlers
  const openServiceDialog = (service?: any) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        serviceId: service.serviceId || '',
        name: service.name,
        status: service.status,
        progress: service.progress.toString(),
        startDate: service.startDate.split('T')[0],
        endDate: service.endDate ? service.endDate.split('T')[0] : '',
        notes: service.notes || '',
      });
    } else {
      setEditingService(null);
      setServiceForm({
        serviceId: '',
        name: '',
        status: 'active',
        progress: '0',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: '',
      });
    }
    setServiceDialogOpen(true);
  };

  const handleServiceSelect = (serviceId: string) => {
    const selectedService = systemServices.find(s => s.id === serviceId);
    setServiceForm({
      ...serviceForm,
      serviceId,
      name: selectedService?.name || serviceForm.name,
    });
  };

  const saveService = async () => {
    try {
      const data = {
        serviceId: serviceForm.serviceId || undefined,
        name: serviceForm.name,
        status: serviceForm.status,
        progress: parseInt(serviceForm.progress) || 0,
        startDate: serviceForm.startDate,
        endDate: serviceForm.endDate || undefined,
        notes: serviceForm.notes || undefined,
      };

      if (editingService) {
        await apiClient.put(`/api/client-portal/admin/services/${editingService.id}`, data);
        toast({ title: 'Servicio actualizado' });
      } else {
        await apiClient.post(`/api/client-portal/admin/clients/${clientId}/services`, data);
        toast({ title: 'Servicio creado' });
      }
      setServiceDialogOpen(false);
      fetchClientDetail();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar el servicio',
        variant: 'destructive',
      });
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      await apiClient.delete(`/api/client-portal/admin/services/${id}`);
      toast({ title: 'Servicio eliminado' });
      fetchClientDetail();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // Access handlers
  const openAccessDialog = () => {
    setAccessForm({ email: '', firstName: '', lastName: '' });
    setAccessDialogOpen(true);
  };

  const createAccess = async () => {
    try {
      setCreatingAccess(true);
      await apiClient.post(`/api/client-portal/admin/clients/${clientId}/access`, accessForm);
      toast({
        title: 'Acceso creado',
        description: 'Se ha enviado un email al usuario con las instrucciones para establecer su contraseña',
      });
      setAccessDialogOpen(false);
      fetchClientDetail();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear acceso',
        variant: 'destructive',
      });
    } finally {
      setCreatingAccess(false);
    }
  };

  const resendAccessEmail = async (userId: string) => {
    try {
      await apiClient.post(`/api/client-portal/admin/users/${userId}/resend-access`, {});
      toast({
        title: 'Email reenviado',
        description: 'Se ha enviado nuevamente el email de acceso',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al reenviar email',
        variant: 'destructive',
      });
    }
  };

  const deletePortalUser = async (userId: string) => {
    if (!confirm('¿Eliminar este usuario del portal? Esta acción no se puede deshacer.')) return;
    try {
      await apiClient.delete(`/api/client-portal/admin/users/${userId}`);
      toast({ title: 'Usuario eliminado' });
      fetchClientDetail();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar usuario',
        variant: 'destructive',
      });
    }
  };

  // Excel handlers
  const openExcelDialog = () => {
    setExcelForm({ name: '', description: '', file: null });
    setExcelDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelForm({
        ...excelForm,
        file,
        name: excelForm.name || file.name.replace(/\.[^/.]+$/, ''),
      });
    }
  };

  const uploadExcel = async () => {
    if (!excelForm.file) return;

    try {
      setUploadingExcel(true);
      const formData = new FormData();
      formData.append('file', excelForm.file);
      formData.append('name', excelForm.name);
      if (excelForm.description) {
        formData.append('description', excelForm.description);
      }

      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/client-portal/admin/clients/${clientId}/excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || 'Error al subir archivo');
        }
        return res.json();
      });

      toast({ title: 'Archivo Excel subido correctamente' });
      setExcelDialogOpen(false);
      fetchExcelFiles();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al subir archivo Excel',
        variant: 'destructive',
      });
    } finally {
      setUploadingExcel(false);
    }
  };

  const viewExcelFile = async (file: ExcelFile) => {
    try {
      const response = await apiClient.get<ExcelFile>(`/api/client-portal/admin/excel/${file.id}`);
      setSelectedExcelFile(response);
      setSelectedSheet(response.sheetNames[0] || '');
      setExcelViewerOpen(true);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Error al cargar el archivo',
        variant: 'destructive',
      });
    }
  };

  const deleteExcelFile = async (id: string) => {
    if (!confirm('¿Eliminar este archivo Excel?')) return;
    try {
      await apiClient.delete(`/api/client-portal/admin/excel/${id}`);
      toast({ title: 'Archivo eliminado' });
      fetchExcelFiles();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Cliente no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {client.logo && client.logo !== '/img/logo.png' ? (
                <img
                  src={client.logo}
                  alt={client.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {client.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{client.name}</h2>
                <p className="text-muted-foreground">{client.email}</p>
              </div>
            </div>
            <Button onClick={openAccessDialog}>
              <UserPlus className="h-4 w-4 mr-2" />
              Dar Acceso
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Section */}
      {client.portalUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios del Portal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {client.portalUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{user.firstName} {user.lastName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>Activo</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resendAccessEmail(user.id)}
                      title="Reenviar email de acceso"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deletePortalUser(user.id)}
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Management Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Campañas
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Presupuesto
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Servicios
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Campañas</CardTitle>
                <CardDescription>Campañas de marketing del cliente</CardDescription>
              </div>
              <Button onClick={() => openCampaignDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Campaña
              </Button>
            </CardHeader>
            <CardContent>
              {client.portalCampaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay campañas registradas
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Presupuesto</TableHead>
                      <TableHead>Gastado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.portalCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell className="capitalize">{campaign.platform}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              campaign.status === 'active'
                                ? 'bg-green-500/10 text-green-600'
                                : campaign.status === 'paused'
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : 'bg-blue-500/10 text-blue-600'
                            }
                          >
                            {campaign.status === 'active' ? 'Activo' : campaign.status === 'paused' ? 'Pausado' : 'Completado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(campaign.budget)}</TableCell>
                        <TableCell>{formatCurrency(campaign.spent)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCampaignDialog(campaign)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteCampaign(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Presupuesto vs Ventas</CardTitle>
                <CardDescription>Datos mensuales de inversión y retorno</CardDescription>
              </div>
              <Button onClick={() => openBudgetDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Mes
              </Button>
            </CardHeader>
            <CardContent>
              {client.portalBudgets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de presupuesto registrados
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead>Presupuesto</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Clientes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.portalBudgets.map((budget) => (
                      <TableRow key={budget.id}>
                        <TableCell className="font-medium">
                          {MONTH_NAMES[budget.month - 1]} {budget.year}
                        </TableCell>
                        <TableCell>{formatCurrency(budget.budget)}</TableCell>
                        <TableCell>{formatCurrency(budget.sales)}</TableCell>
                        <TableCell>{budget.leads}</TableCell>
                        <TableCell>{budget.customers}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openBudgetDialog(budget)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteBudget(budget.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Servicios</CardTitle>
                <CardDescription>Estado de servicios contratados</CardDescription>
              </div>
              <Button onClick={() => openServiceDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Servicio
              </Button>
            </CardHeader>
            <CardContent>
              {client.portalServices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay servicios registrados
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Progreso</TableHead>
                      <TableHead>Fecha Inicio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.portalServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">
                          {service.service ? (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              {service.name}
                            </div>
                          ) : (
                            service.name
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              service.status === 'active'
                                ? 'bg-green-500/10 text-green-600'
                                : service.status === 'pending'
                                ? 'bg-orange-500/10 text-orange-600'
                                : service.status === 'paused'
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : 'bg-blue-500/10 text-blue-600'
                            }
                          >
                            {service.status === 'active' ? 'Activo' : service.status === 'pending' ? 'Pendiente' : service.status === 'paused' ? 'Pausado' : 'Completado'}
                          </Badge>
                        </TableCell>
                        <TableCell>{service.progress}%</TableCell>
                        <TableCell>
                          {new Date(service.startDate).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openServiceDialog(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteService(service.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Excel/Reports Tab */}
        <TabsContent value="excel">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Reportes Excel</CardTitle>
                <CardDescription>Archivos Excel para visualizar en el portal del cliente</CardDescription>
              </div>
              <Button onClick={openExcelDialog}>
                <Upload className="h-4 w-4 mr-2" />
                Subir Excel
              </Button>
            </CardHeader>
            <CardContent>
              {excelFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay archivos Excel cargados</p>
                  <p className="text-sm">Sube un archivo Excel para que el cliente pueda verlo en su portal</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Hojas</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelFiles.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell className="text-muted-foreground">{file.fileName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{file.sheetNames.length} hoja(s)</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(file.createdAt).toLocaleDateString('es-ES')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewExcelFile(file)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteExcelFile(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Nombre</Label>
              <Input
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="Nombre de la campaña"
              />
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={campaignForm.platform}
                onValueChange={(v) => setCampaignForm({ ...campaignForm, platform: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={campaignForm.status}
                onValueChange={(v) => setCampaignForm({ ...campaignForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Presupuesto (COP)</Label>
              <Input
                type="number"
                value={campaignForm.budget}
                onChange={(e) => setCampaignForm({ ...campaignForm, budget: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gastado (COP)</Label>
              <Input
                type="number"
                value={campaignForm.spent}
                onChange={(e) => setCampaignForm({ ...campaignForm, spent: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Impresiones</Label>
              <Input
                type="number"
                value={campaignForm.impressions}
                onChange={(e) => setCampaignForm({ ...campaignForm, impressions: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Clicks</Label>
              <Input
                type="number"
                value={campaignForm.clicks}
                onChange={(e) => setCampaignForm({ ...campaignForm, clicks: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Conversiones</Label>
              <Input
                type="number"
                value={campaignForm.conversions}
                onChange={(e) => setCampaignForm({ ...campaignForm, conversions: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={campaignForm.startDate}
                onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin (opcional)</Label>
              <Input
                type="date"
                value={campaignForm.endDate}
                onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={campaignForm.notes}
                onChange={(e) => setCampaignForm({ ...campaignForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCampaign} disabled={!campaignForm.name || !campaignForm.budget}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'Editar Presupuesto' : 'Agregar Presupuesto Mensual'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select
                value={budgetForm.month.toString()}
                onValueChange={(v) => setBudgetForm({ ...budgetForm, month: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((month, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select
                value={budgetForm.year.toString()}
                onValueChange={(v) => setBudgetForm({ ...budgetForm, year: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Presupuesto (COP)</Label>
              <Input
                type="number"
                value={budgetForm.budget}
                onChange={(e) => setBudgetForm({ ...budgetForm, budget: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ventas (COP)</Label>
              <Input
                type="number"
                value={budgetForm.sales}
                onChange={(e) => setBudgetForm({ ...budgetForm, sales: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Leads</Label>
              <Input
                type="number"
                value={budgetForm.leads}
                onChange={(e) => setBudgetForm({ ...budgetForm, leads: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Clientes Nuevos</Label>
              <Input
                type="number"
                value={budgetForm.customers}
                onChange={(e) => setBudgetForm({ ...budgetForm, customers: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={budgetForm.notes}
                onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveBudget} disabled={!budgetForm.budget}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Seleccionar Servicio del Sistema</Label>
              <Select
                value={serviceForm.serviceId}
                onValueChange={handleServiceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio existente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Servicio personalizado --</SelectItem>
                  {systemServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Puedes seleccionar un servicio existente o escribir uno personalizado
              </p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Nombre del Servicio</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="Ej: SEO, Social Media, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={serviceForm.status}
                onValueChange={(v) => setServiceForm({ ...serviceForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progreso (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={serviceForm.progress}
                onChange={(e) => setServiceForm({ ...serviceForm, progress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={serviceForm.startDate}
                onChange={(e) => setServiceForm({ ...serviceForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin (opcional)</Label>
              <Input
                type="date"
                value={serviceForm.endDate}
                onChange={(e) => setServiceForm({ ...serviceForm, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notas</Label>
              <Textarea
                value={serviceForm.notes}
                onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveService} disabled={!serviceForm.name}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Archivo Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Archivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Formatos permitidos: .xlsx, .xls, .csv (máx 10MB)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nombre del reporte</Label>
              <Input
                value={excelForm.name}
                onChange={(e) => setExcelForm({ ...excelForm, name: e.target.value })}
                placeholder="Ej: Reporte de Ventas Q1"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={excelForm.description}
                onChange={(e) => setExcelForm({ ...excelForm, description: e.target.value })}
                placeholder="Descripción del reporte..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcelDialogOpen(false)} disabled={uploadingExcel}>
              Cancelar
            </Button>
            <Button onClick={uploadExcel} disabled={!excelForm.file || !excelForm.name || uploadingExcel}>
              {uploadingExcel ? 'Subiendo...' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Viewer Dialog */}
      <Dialog open={excelViewerOpen} onOpenChange={setExcelViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedExcelFile?.name}</DialogTitle>
              {selectedExcelFile && selectedExcelFile.sheetNames.length > 1 && (
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedExcelFile.sheetNames.map((sheet) => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {selectedExcelFile?.data && selectedSheet && (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {(selectedExcelFile.data[selectedSheet] || []).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted font-medium' : ''}>
                      {row.map((cell: any, cellIndex: number) => (
                        <td
                          key={cellIndex}
                          className="border border-border px-3 py-2 whitespace-nowrap"
                        >
                          {cell !== null && cell !== undefined ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar Acceso al Portal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Ingresa los datos del usuario. Se creará su cuenta y recibirá un email con las instrucciones para establecer su contraseña.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={accessForm.firstName}
                  onChange={(e) => setAccessForm({ ...accessForm, firstName: e.target.value })}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={accessForm.lastName}
                  onChange={(e) => setAccessForm({ ...accessForm, lastName: e.target.value })}
                  placeholder="Pérez"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={accessForm.email}
                onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })}
                placeholder="cliente@empresa.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={creatingAccess}>
              Cancelar
            </Button>
            <Button
              onClick={createAccess}
              disabled={!accessForm.email || !accessForm.firstName || !accessForm.lastName || creatingAccess}
            >
              {creatingAccess ? 'Creando...' : 'Crear Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
