import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PlusCircle, Trash2, FileText, CheckSquare, Square, Check, ChevronsUpDown,
  Send, CircleCheck, Clock, ShieldCheck, FileEdit, Ban,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FactusDialog } from '@/components/finance/FactusDialog';

// --- Data Interfaces ---
interface Client {
  id: string;
  name: string;
  email: string;
  nit?: string;
  phone?: string;
  address?: string;
  logo: string;
  status: string;
  municipio?: string | null; // código DANE para facturación electrónica
  tipoFacturacion?: string; // cuenta_cobro | factura_electronica
  createdAt: string;
}

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

interface ServiceItem {
  id: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  serviceId?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  fecha: string;
  concepto: string | null;
  servicio: string | null;
  status: 'pendiente' | 'enviada' | 'pagada';
  paidAt: string | null;
  createdAt: string;
  // Factura electrónica DIAN (Factus): sin factusNumber = borrador, con = enviada a DIAN
  factusNumber?: string | null;
  factusCufe?: string | null;
  factusStatus?: string | null;
  factusNcNumber?: string | null;
  factusNcValidatedAt?: string | null;
}

const INVOICE_STATUS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: Send },
  pagada: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: CircleCheck },
} as const;

const statusInfo = (s?: string) => INVOICE_STATUS[(s || 'pendiente') as keyof typeof INVOICE_STATUS] || INVOICE_STATUS.pendiente;

const Facturas = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'borradores' | 'enviadas'>('enviadas');

  const [invoiceData, setInvoiceData] = useState({
    cliente_id: '',
    nombre_cliente: '',
    identificacion: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: 'Prestación de servicios profesionales de marketing digital y desarrollo de software',
    servicio_proyecto: '',
    observaciones: 'Factura electrónica de venta.',
  });

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { id: 1, descripcion: '', cantidad: 1, precio_unitario: 0 },
  ]);

  useEffect(() => {
    fetchData();
  }, [toast]);

  const fetchData = async () => {
    try {
      const [clientsData, servicesData, invoicesData] = await Promise.all([
        apiClient.get<Client[]>('/api/clients'),
        apiClient.get<Service[]>('/api/services'),
        apiClient.get<Invoice[]>('/api/invoices?tipoDocumento=factura_electronica'),
      ]);
      setClients(clientsData);
      setServices(servicesData);
      setInvoices(invoicesData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos.',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoiceData((prev) => ({ ...prev, [name]: value }));
  };

  // Mismos terceros/clientes que en Cuentas de Cobro: cualquier cliente puede
  // facturarse como factura electrónica, sin importar su tipoFacturacion por defecto.
  const facturaClients = clients;

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return facturaClients;
    const query = clientSearchQuery.toLowerCase();
    return facturaClients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      (client.nit && client.nit.toLowerCase().includes(query))
    );
  }, [facturaClients, clientSearchQuery]);

  const borradores = useMemo(() => invoices.filter((inv) => !inv.factusNumber), [invoices]);
  const enviadas = useMemo(() => invoices.filter((inv) => !!inv.factusNumber), [invoices]);
  const visibleInvoices = activeTab === 'borradores' ? borradores : enviadas;

  // Filas a renderizar: cada nota crédito de una factura anulada se muestra
  // como su propia fila (con el valor en negativo), justo debajo de la factura.
  type FilaFactura =
    | { kind: 'factura'; invoice: Invoice }
    | { kind: 'nota_credito'; invoice: Invoice };
  const visibleRows = useMemo<FilaFactura[]>(
    () =>
      visibleInvoices.flatMap((invoice) => {
        const filas: FilaFactura[] = [{ kind: 'factura', invoice }];
        if (invoice.factusStatus === 'anulada' && invoice.factusNcNumber) {
          filas.push({ kind: 'nota_credito', invoice });
        }
        return filas;
      }),
    [visibleInvoices]
  );

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setInvoiceData({
        ...invoiceData,
        cliente_id: clientId,
        nombre_cliente: client.name,
        identificacion: client.nit || '',
      });
      setClientSearchOpen(false);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: 'pendiente' | 'enviada' | 'pagada') => {
    try {
      await apiClient.patch(`/api/invoices/${invoiceId}/status`, { status: newStatus });
      toast({
        title: 'Estado actualizado',
        description: newStatus === 'pagada'
          ? 'La factura se marcó como pagada y se registró el ingreso en Finanzas.'
          : `Estado cambiado a "${INVOICE_STATUS[newStatus].label}"`,
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado.',
        variant: 'destructive',
      });
    }
  };

  const handleServiceItemChange = (id: number, field: keyof ServiceItem, value: string | number) => {
    setServiceItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addServiceItem = () => {
    setServiceItems((prev) => [
      ...prev,
      { id: Date.now(), descripcion: '', cantidad: 1, precio_unitario: 0 },
    ]);
  };

  const removeServiceItem = (id: number) => {
    setServiceItems((prev) => prev.filter((item) => item.id !== id));
  };

  const calculateTotal = (item: ServiceItem) => item.cantidad * item.precio_unitario;

  const grandTotal = serviceItems
    .filter(item => item.descripcion.trim() !== '')
    .reduce((acc, item) => acc + calculateTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const usados = serviceItems.filter(item => item.descripcion.trim() !== '');

    const faltantes: string[] = [];
    if (!invoiceData.nombre_cliente) faltantes.push('selecciona el cliente');
    if (!invoiceData.identificacion.trim()) faltantes.push('escribe el NIT o cédula del cliente (no la tiene registrada en su ficha)');
    if (usados.length === 0) faltantes.push('agrega al menos un servicio con descripción');
    if (!invoiceData.fecha) faltantes.push('elige la fecha');
    if (faltantes.length > 0) {
      toast({
        title: 'Faltan datos para guardar el borrador',
        description: faltantes.join(' · '),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const submissionData = {
      ...invoiceData,
      serviceId: usados.find(i => i.serviceId)?.serviceId,
      servicios: usados.map(({ id, serviceId, ...rest }) => rest),
      tipoDocumento: 'factura_electronica',
    };

    try {
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${API_URL}/api/invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate invoice');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');

      toast({
        title: 'Borrador guardado',
        description: 'La factura quedó como borrador. Emítela a la DIAN desde la pestaña "Borradores" cuando esté lista.',
      });

      setActiveTab('borradores');
      fetchData();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Hubo un problema al guardar el borrador.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (invoice: Invoice) => {
    try {
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // Ya emitida: PDF con membrete DIAN (CUFE, QR), regenerado al vuelo desde
      // los datos guardados — no hace falta reemitir para corregir el diseño o
      // ver una descripción actualizada. Borrador: el PDF simple del formulario.
      const authHeader = { 'Authorization': token ? `Bearer ${token}` : '' };
      let response = invoice.factusNumber
        ? await fetch(`${API_URL}/api/factus/pdf-propio/${invoice.id}`, { headers: authHeader })
        : await fetch(`${API_URL}/api/invoices/${invoice.id}/download`, { headers: authHeader });

      // Respaldo: si el PDF con membrete falla (ej. CUFE aún no confirmado),
      // se cae al PDF del borrador en vez de mostrar un error.
      if (!response.ok && invoice.factusNumber) {
        response = await fetch(`${API_URL}/api/invoices/${invoice.id}/download`, { headers: authHeader });
      }

      if (!response.ok) {
        throw new Error('Failed to load invoice');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo abrir la factura.',
        variant: 'destructive',
      });
    }
  };

  const [factusInvoice, setFactusInvoice] = useState<Invoice | null>(null);

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('¿Estás seguro de eliminar este borrador de factura?')) return;

    try {
      await apiClient.delete(`/api/invoices/${invoiceId}`);
      toast({
        title: 'Eliminado',
        description: 'El borrador se eliminó correctamente.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el borrador.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(invoiceId); else newSet.delete(invoiceId);
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedInvoices(checked ? new Set(visibleInvoices.map(inv => inv.id)) : new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;
    const count = selectedInvoices.size;
    if (!confirm(`¿Estás seguro de eliminar ${count} factura(s)?`)) return;

    try {
      await Promise.all(Array.from(selectedInvoices).map(id => apiClient.delete(`/api/invoices/${id}`)));
      toast({ title: 'Eliminado', description: `${count} factura(s) eliminada(s) correctamente.` });
      setSelectedInvoices(new Set());
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar algunas facturas.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Generar Factura Electrónica</h1>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cliente_id">Cliente</Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className="w-full justify-between"
                  >
                    {invoiceData.cliente_id
                      ? clients.find(c => c.id === invoiceData.cliente_id)?.name
                      : "Buscar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar por nombre o NIT..."
                      value={clientSearchQuery}
                      onValueChange={setClientSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        No se encontraron clientes.
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.id}
                            onSelect={() => handleClientChange(client.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                invoiceData.cliente_id === client.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{client.name}</span>
                              {client.nit && (
                                <span className="text-xs text-muted-foreground">NIT: {client.nit}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Se muestran todos los clientes, igual que en Cuentas de Cobro.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identificacion">Identificación (NIT/CC)</Label>
              <Input id="identificacion" name="identificacion" value={invoiceData.identificacion} readOnly disabled className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" value={invoiceData.fecha} onChange={handleInputChange} className="w-full" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="servicio_proyecto">Servicio / Proyecto</Label>
              <Input id="servicio_proyecto" name="servicio_proyecto" value={invoiceData.servicio_proyecto} onChange={handleInputChange} placeholder="Ej: Mantenimiento Web" className="w-full" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="concepto">Observaciones</Label>
              <Textarea id="concepto" name="concepto" value={invoiceData.concepto} onChange={handleInputChange} rows={2} className="w-full" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="observaciones">Concepto General</Label>
              <Textarea id="observaciones" name="observaciones" value={invoiceData.observaciones} onChange={handleInputChange} rows={3} className="w-full" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ítems de Servicio</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/servicios', '_blank')}
                className="text-xs"
              >
                Gestionar Servicios
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                      <Label>Seleccionar Servicio</Label>
                      <Select onValueChange={(serviceId) => {
                        const service = services.find(s => s.id === serviceId);
                        if (service) {
                          handleServiceItemChange(item.id, 'serviceId', serviceId);
                          handleServiceItemChange(item.id, 'descripcion', service.description || service.name);
                          handleServiceItemChange(item.id, 'precio_unitario', service.price);
                        }
                      }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegir servicio..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services.filter(s => s.status === 'active').map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Descripción</Label>
                      <Input
                        placeholder="Descripción del servicio"
                        value={item.descripcion}
                        onChange={(e) => handleServiceItemChange(item.id, 'descripcion', e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={item.cantidad}
                        onChange={(e) => handleServiceItemChange(item.id, 'cantidad', Number(e.target.value))}
                        className="w-full min-w-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={item.precio_unitario}
                        onChange={(e) => handleServiceItemChange(item.id, 'precio_unitario', Number(e.target.value))}
                        className="w-full min-w-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <Input
                        value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(calculateTotal(item))}
                        readOnly
                        disabled
                        className="w-full min-w-[120px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeServiceItem(item.id)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={addServiceItem} className="mt-4">
              <PlusCircle className="h-4 w-4 mr-2" />
              Añadir Ítem
            </Button>
          </CardContent>
          <CardFooter className="flex justify-end font-bold text-lg sm:text-xl pr-6 break-words">
            Total General: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(grandTotal)}
          </CardFooter>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Guardando...' : 'Guardar Borrador'}
          </Button>
        </div>
      </form>

      {/* Facturas: Borradores / Enviadas a DIAN */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Facturas
            </CardTitle>
            {selectedInvoices.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar {selectedInvoices.size} seleccionado(s)
              </Button>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'borradores' | 'enviadas'); setSelectedInvoices(new Set()); }} className="mt-2">
            <TabsList>
              <TabsTrigger value="borradores" className="flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                Borradores
                <Badge variant="secondary" className="ml-1">{borradores.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="enviadas" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Enviadas a DIAN
                <Badge variant="secondary" className="ml-1">{enviadas.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {visibleInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeTab === 'borradores' ? 'No hay borradores pendientes de enviar.' : 'Todavía no se ha enviado ninguna factura a la DIAN.'}
            </div>
          ) : (
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAll(selectedInvoices.size !== visibleInvoices.length)}
                        className="h-6 w-6 p-0"
                      >
                        {selectedInvoices.size === visibleInvoices.length && visibleInvoices.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-[150px]">N° / CUFE</TableHead>
                    <TableHead className="min-w-[100px]">Fecha</TableHead>
                    <TableHead className="min-w-[150px]">Cliente</TableHead>
                    <TableHead className="text-right min-w-[120px]">Valor</TableHead>
                    <TableHead className="min-w-[130px]">Estado de cobro</TableHead>
                    <TableHead className="text-right min-w-[140px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => {
                    if (row.kind === 'nota_credito') {
                      const invoice = row.invoice;
                      return (
                        <TableRow key={`${invoice.id}-nc`} className="bg-red-50/40 hover:bg-red-50/60">
                          <TableCell />
                          <TableCell className="font-medium">
                            <Badge variant="outline" className="flex w-fit items-center gap-1 border-red-300 text-red-700">
                              <Ban className="h-3 w-3" />
                              NC {invoice.factusNcNumber}
                            </Badge>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Anulación de {invoice.factusNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="whitespace-nowrap">
                              {new Date(invoice.factusNcValidatedAt || invoice.fecha).toLocaleDateString('es-CO')}
                            </span>
                          </TableCell>
                          <TableCell className="break-words">{invoice.clientName}</TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium text-red-600">
                            -{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 border-red-300 text-red-700">
                              <Ban className="h-3 w-3" />
                              Nota crédito
                            </Badge>
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    }

                    const invoice = row.invoice;
                    return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="break-words">#{invoice.invoiceNumber.substring(0, 12)}...</span>
                        {invoice.factusNumber && (
                          <Badge variant="outline" className="mt-1 flex w-fit items-center gap-1 border-emerald-300 text-emerald-700">
                            <ShieldCheck className="h-3 w-3" />
                            {invoice.factusNumber}
                          </Badge>
                        )}
                        {invoice.factusStatus === 'anulada' && invoice.factusNcNumber && (
                          <Badge
                            variant="outline"
                            className="mt-1 flex w-fit items-center gap-1 border-red-300 text-red-700"
                            title={`Anulada con la nota crédito ${invoice.factusNcNumber}`}
                          >
                            <Ban className="h-3 w-3" />
                            NC {invoice.factusNcNumber}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap">{new Date(invoice.fecha).toLocaleDateString('es-CO')}</span>
                      </TableCell>
                      <TableCell className="break-words">{invoice.clientName}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {invoice.factusStatus === 'anulada' ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs text-muted-foreground line-through">
                              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)}
                            </span>
                            <span className="font-medium text-red-600">
                              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(0)}
                            </span>
                          </div>
                        ) : (
                          new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.factusStatus === 'anulada' ? (
                          <Badge variant="outline" className="gap-1 border-red-300 text-red-700" title="Anulada por nota crédito: el valor de esta factura quedó en $0">
                            <Ban className="h-3 w-3" />
                            Anulada
                          </Badge>
                        ) : (
                          <Select
                            value={invoice.status || 'pendiente'}
                            onValueChange={(value) => handleStatusChange(invoice.id, value as 'pendiente' | 'enviada' | 'pagada')}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue>
                                {(() => {
                                  const status = statusInfo(invoice.status);
                                  const StatusIcon = status.icon;
                                  return (
                                    <Badge className={cn("gap-1", status.color)}>
                                      <StatusIcon className="h-3 w-3" />
                                      {status.label}
                                    </Badge>
                                  );
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-yellow-600" />
                                  Pendiente
                                </div>
                              </SelectItem>
                              <SelectItem value="enviada">
                                <div className="flex items-center gap-2">
                                  <Send className="h-3 w-3 text-blue-600" />
                                  Enviada
                                </div>
                              </SelectItem>
                              <SelectItem value="pagada">
                                <div className="flex items-center gap-2">
                                  <CircleCheck className="h-3 w-3 text-green-600" />
                                  Pagada
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(invoice)}
                            title="Ver PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {invoice.factusNumber ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFactusInvoice(invoice)}
                              title={`Factura electrónica ${invoice.factusNumber}`}
                              className="text-emerald-600 hover:text-emerald-700"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setFactusInvoice(invoice)}
                              title="Enviar a la DIAN"
                              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              Enviar a DIAN
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(invoice.id)}
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
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
          )}
        </CardContent>
      </Card>

      <FactusDialog
        invoice={factusInvoice}
        onClose={() => setFactusInvoice(null)}
        clientMunicipio={clients.find((c) => c.id === factusInvoice?.clientId)?.municipio}
        clientEmail={clients.find((c) => c.id === factusInvoice?.clientId)?.email}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default Facturas;
