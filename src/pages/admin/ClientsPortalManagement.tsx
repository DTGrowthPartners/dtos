import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Mail,
  Search,
  ArrowLeft,
  Plus,
  UserPlus,
  Eye,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { ClientDataManager } from '@/components/admin/ClientDataManager';
import { useToast } from '@/hooks/use-toast';

interface PortalClient {
  id: string;
  name: string;
  email: string;
  logo: string;
  status: string;
  portalUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }>;
  _count: {
    portalCampaigns: number;
    portalBudgets: number;
    portalServices: number;
    portalInvitations: number;
  };
}

export default function ClientsPortalManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<PortalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessClientId, setAccessClientId] = useState<string | null>(null);
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [accessForm, setAccessForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<PortalClient[]>('/api/client-portal/admin/clients');
      setClients(response);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccess = async () => {
    if (!accessClientId || !accessForm.email.trim() || !accessForm.firstName.trim() || !accessForm.lastName.trim()) return;

    try {
      setCreatingAccess(true);
      await apiClient.post(`/api/client-portal/admin/clients/${accessClientId}/access`, accessForm);
      toast({
        title: 'Acceso creado',
        description: `Se ha enviado un email a ${accessForm.email} con las instrucciones para establecer su contraseña`,
      });
      setAccessDialogOpen(false);
      setAccessForm({ email: '', firstName: '', lastName: '' });
      fetchClients();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear el acceso',
        variant: 'destructive',
      });
    } finally {
      setCreatingAccess(false);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  // If a client is selected, show the data manager
  if (selectedClient) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => setSelectedClient(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a la lista
        </Button>
        <ClientDataManager clientId={selectedClient} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portal de Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona los datos del portal para tus clientes
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            Selecciona un cliente para gestionar sus datos del portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay clientes disponibles</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Usuarios Portal</TableHead>
                  <TableHead>Campañas</TableHead>
                  <TableHead>Presupuestos</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {client.logo && client.logo !== '/img/logo.png' ? (
                          <img
                            src={client.logo}
                            alt={client.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {client.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{client.portalUsers.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span>{client._count.portalCampaigns}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{client._count.portalBudgets}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{client._count.portalServices}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAccessClientId(client.id);
                            setAccessDialogOpen(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Dar Acceso
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSelectedClient(client.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Gestionar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  placeholder="Juan"
                  value={accessForm.firstName}
                  onChange={(e) => setAccessForm({ ...accessForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apellido</label>
                <Input
                  placeholder="Pérez"
                  value={accessForm.lastName}
                  onChange={(e) => setAccessForm({ ...accessForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email del usuario</label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={accessForm.email}
                onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={creatingAccess}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAccess}
              disabled={!accessForm.email.trim() || !accessForm.firstName.trim() || !accessForm.lastName.trim() || creatingAccess}
            >
              {creatingAccess ? 'Creando...' : 'Crear Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
