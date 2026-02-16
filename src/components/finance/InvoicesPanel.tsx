import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, CheckSquare, Square, Check, ChevronsUpDown, Send, CircleCheck, Clock, Banknote, Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
}

interface InvoicePayment {
  id: string;
  amount: number;
  paidAt: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  paidAmount: number;
  fecha: string;
  concepto: string | null;
  servicio: string | null;
  status: 'pendiente' | 'enviada' | 'parcial' | 'pagada';
  paidAt: string | null;
  payments?: InvoicePayment[];
  createdAt: string;
}

const INVOICE_STATUS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: Send },
  parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: Clock },
  pagada: { label: 'Pagada', color: 'bg-green-100 text-green-800', icon: CircleCheck },
} as const;

export default function InvoicesPanel() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Estado para el diálogo de confirmación de pago
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingPaymentInvoiceId, setPendingPaymentInvoiceId] = useState<string | null>(null);
  const [registerInSheets, setRegisterInSheets] = useState(true);
  const [paymentCuenta, setPaymentCuenta] = useState('Principal');

  // Estado para diálogo de abono parcial
  const [abonoDialogOpen, setAbonoDialogOpen] = useState(false);
  const [selectedInvoiceForAbono, setSelectedInvoiceForAbono] = useState<Invoice | null>(null);
  const [abonoForm, setAbonoForm] = useState({
    amount: '',
    paymentMethod: 'transferencia',
    reference: '',
    notes: '',
    registerInSheets: true,
    cuenta: 'Principal',
  });
  const [isSubmittingAbono, setIsSubmittingAbono] = useState(false);

  // Estado para historial de pagos
  const [paymentsDialogOpen, setPaymentsDialogOpen] = useState(false);
  const [selectedInvoicePayments, setSelectedInvoicePayments] = useState<Invoice | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const [invoiceData, setInvoiceData] = useState({
    cliente_id: '',
    nombre_cliente: '',
    identificacion: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: 'Prestacion de servicios profesionales de marketing digital y desarrollo de software',
    servicio_proyecto: '',
    observaciones: 'No responsable de IVA. Cuenta de cobro emitida bajo el regimen de tributacion simplificada.',
  });

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { id: 1, descripcion: '', cantidad: 1, precio_unitario: 0 },
  ]);

  // --- Data Fetching ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsData, servicesData, invoicesData] = await Promise.all([
        apiClient.get<Client[]>('/api/clients'),
        apiClient.get<Service[]>('/api/services'),
        apiClient.get<Invoice[]>('/api/invoices'),
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

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoiceData((prev) => ({ ...prev, [name]: value }));
  };

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      (client.nit && client.nit.toLowerCase().includes(query))
    );
  }, [clients, clientSearchQuery]);

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

  const handleStatusChange = async (invoiceId: string, newStatus: 'pendiente' | 'enviada' | 'parcial' | 'pagada') => {
    // Si se selecciona parcial, abrir diálogo de abono
    if (newStatus === 'parcial') {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice) openAbonoDialog(invoice);
      return;
    }
    // Si se marca como pagada, mostrar diálogo de confirmación
    if (newStatus === 'pagada') {
      setPendingPaymentInvoiceId(invoiceId);
      setRegisterInSheets(true);
      setPaymentCuenta('Principal');
      setPaymentDialogOpen(true);
      return;
    }

    try {
      await apiClient.patch(`/api/invoices/${invoiceId}/status`, { status: newStatus });
      toast({
        title: 'Estado actualizado',
        description: `Estado cambiado a "${INVOICE_STATUS[newStatus].label}"`,
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

  const handleConfirmPayment = async () => {
    if (!pendingPaymentInvoiceId) return;

    try {
      await apiClient.patch(`/api/invoices/${pendingPaymentInvoiceId}/status`, {
        status: 'pagada',
        registerInSheets,
        cuenta: paymentCuenta,
      });
      toast({
        title: 'Cuenta marcada como pagada',
        description: registerInSheets
          ? 'Se registró el ingreso en Google Sheets (Finanzas).'
          : 'No se registró el ingreso en Google Sheets.',
      });
      setPaymentDialogOpen(false);
      setPendingPaymentInvoiceId(null);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado.',
        variant: 'destructive',
      });
    }
  };

  // --- Abono Handlers ---
  const openAbonoDialog = (invoice: Invoice) => {
    setSelectedInvoiceForAbono(invoice);
    const saldo = invoice.totalAmount - (invoice.paidAmount || 0);
    setAbonoForm({
      amount: String(saldo),
      paymentMethod: 'transferencia',
      reference: invoice.invoiceNumber,
      notes: '',
      registerInSheets: true,
      cuenta: 'Principal',
    });
    setAbonoDialogOpen(true);
  };

  const handleSubmitAbono = async () => {
    if (!selectedInvoiceForAbono) return;
    const amount = parseFloat(abonoForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'El monto debe ser mayor a 0.', variant: 'destructive' });
      return;
    }
    const saldo = selectedInvoiceForAbono.totalAmount - (selectedInvoiceForAbono.paidAmount || 0);
    if (amount > saldo) {
      toast({ title: 'Error', description: `El monto no puede superar el saldo pendiente (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(saldo)}).`, variant: 'destructive' });
      return;
    }

    setIsSubmittingAbono(true);
    try {
      await apiClient.post(`/api/invoices/${selectedInvoiceForAbono.id}/payments`, {
        amount,
        paymentMethod: abonoForm.paymentMethod,
        reference: abonoForm.reference || undefined,
        notes: abonoForm.notes || undefined,
        registerInSheets: abonoForm.registerInSheets,
        cuenta: abonoForm.cuenta,
      });
      toast({
        title: 'Abono registrado',
        description: `Se registró un abono de ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount)}.`,
      });
      setAbonoDialogOpen(false);
      setSelectedInvoiceForAbono(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo registrar el abono.', variant: 'destructive' });
    } finally {
      setIsSubmittingAbono(false);
    }
  };

  const openPaymentsHistory = async (invoice: Invoice) => {
    setSelectedInvoicePayments(invoice);
    setPaymentsDialogOpen(true);
    setIsLoadingPayments(true);
    try {
      const payments = await apiClient.get<InvoicePayment[]>(`/api/invoices/${invoice.id}/payments`);
      setInvoicePayments(payments);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los pagos.', variant: 'destructive' });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedInvoicePayments) return;
    if (!confirm('¿Eliminar este abono?')) return;
    try {
      await apiClient.delete(`/api/invoices/${selectedInvoicePayments.id}/payments/${paymentId}`);
      toast({ title: 'Abono eliminado', description: 'El abono fue eliminado correctamente.' });
      // Refresh payments list
      const payments = await apiClient.get<InvoicePayment[]>(`/api/invoices/${selectedInvoicePayments.id}/payments`);
      setInvoicePayments(payments);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el abono.', variant: 'destructive' });
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

  const calculateTotal = (item: ServiceItem) => {
    return item.cantidad * item.precio_unitario;
  };

  const grandTotal = serviceItems
    .filter(item => item.descripcion.trim() !== '')
    .reduce((acc, item) => acc + calculateTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const submissionData = {
      ...invoiceData,
      servicios: serviceItems
        .filter(item => item.descripcion.trim() !== '')
        .map(({ id, ...rest }) => rest),
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
        title: 'Exito',
        description: 'La cuenta de cobro se ha generado y abierta en una nueva pestana.',
      });

      fetchData();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Hubo un problema al generar la cuenta de cobro.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (invoiceId: string) => {
    try {
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load invoice');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo abrir la cuenta de cobro.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Estas seguro de eliminar esta cuenta de cobro?')) return;

    try {
      await apiClient.delete(`/api/invoices/${invoiceId}`);
      toast({
        title: 'Eliminado',
        description: 'La cuenta de cobro se elimino correctamente.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta de cobro.',
        variant: 'destructive',
      });
    }
  };

  const handleSelectInvoice = (invoiceId: string, checked: boolean) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(invoiceId);
      } else {
        newSet.delete(invoiceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;

    const count = selectedInvoices.size;
    if (!confirm(`Estas seguro de eliminar ${count} cuenta(s) de cobro?`)) return;

    try {
      const deletePromises = Array.from(selectedInvoices).map(id =>
        apiClient.delete(`/api/invoices/${id}`)
      );
      await Promise.all(deletePromises);

      toast({
        title: 'Eliminado',
        description: `${count} cuenta(s) de cobro eliminada(s) correctamente.`,
      });
      setSelectedInvoices(new Set());
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar algunas cuentas de cobro.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Nueva Cuenta de Cobro</CardTitle>
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
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="identificacion">Identificacion (NIT/CC)</Label>
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
            <CardTitle>Items de Servicio</CardTitle>
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
                      <Label>Descripcion</Label>
                      <Input
                        placeholder="Descripcion del servicio"
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
              Anadir Item
            </Button>
          </CardContent>
          <CardFooter className="flex justify-end font-bold text-lg sm:text-xl pr-6 break-words">
            Total General: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(grandTotal)}
          </CardFooter>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Generando...' : 'Generar Cuenta de Cobro'}
          </Button>
        </div>
      </form>

      {/* Cuentas Generadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Cuentas Generadas
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
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay cuentas de cobro generadas
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll(selectedInvoices.size !== invoices.length)}
                          className="h-6 w-6 p-0"
                        >
                          {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[150px]">N Cuenta</TableHead>
                      <TableHead className="min-w-[100px]">Fecha</TableHead>
                      <TableHead className="min-w-[150px]">Cliente</TableHead>
                      <TableHead className="text-right min-w-[120px]">Valor</TableHead>
                      <TableHead className="text-right min-w-[120px]">Saldo</TableHead>
                      <TableHead className="min-w-[130px]">Estado</TableHead>
                      <TableHead className="text-right min-w-[150px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const hasPayments = invoice.paidAmount > 0 || (invoice.payments && invoice.payments.length > 0);
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
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap">{new Date(invoice.fecha).toLocaleDateString('es-CO')}</span>
                        </TableCell>
                        <TableCell className="break-words">{invoice.clientName}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {(() => {
                            const saldo = invoice.totalAmount - (invoice.paidAmount || 0);
                            const isPaid = saldo <= 0;
                            return (
                              <span className={isPaid ? 'text-green-600 font-medium' : (invoice.paidAmount > 0 ? 'text-orange-600 font-medium' : '')}>
                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(saldo)}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={invoice.status || 'pendiente'}
                            onValueChange={(value) => handleStatusChange(invoice.id, value as 'pendiente' | 'enviada' | 'parcial' | 'pagada')}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue>
                                {(() => {
                                  const status = INVOICE_STATUS[invoice.status || 'pendiente'];
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
                              <SelectItem value="parcial">
                                <div className="flex items-center gap-2">
                                  <Banknote className="h-3 w-3 text-orange-600" />
                                  Abono Parcial
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
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {invoice.status !== 'pagada' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAbonoDialog(invoice)}
                                title="Agregar Abono"
                                className="text-orange-600 hover:text-orange-700 border-orange-300 hover:bg-orange-50"
                              >
                                <Banknote className="h-4 w-4 mr-1" />
                                Abono
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => hasPayments ? openPaymentsHistory(invoice) : undefined}
                              title={hasPayments ? "Ver Abonos" : "Sin abonos aún"}
                              className={hasPayments ? "text-blue-600 hover:text-blue-700" : "text-muted-foreground/30 cursor-default"}
                              disabled={!hasPayments}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(invoice.id)}
                              title="Ver PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {/* Select all */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(selectedInvoices.size !== invoices.length)}
                    className="h-7 w-7 p-0"
                  >
                    {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">Seleccionar todo</span>
                </div>

                {invoices.map((invoice) => {
                  const saldo = invoice.totalAmount - (invoice.paidAmount || 0);
                  const isPaid = saldo <= 0;
                  const hasPayments = invoice.paidAmount > 0 || (invoice.payments && invoice.payments.length > 0);
                  const status = INVOICE_STATUS[invoice.status || 'pendiente'];
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={invoice.id}
                      className={`rounded-xl border p-3 space-y-2.5 ${
                        selectedInvoices.has(invoice.id) ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      {/* Row 1: Checkbox + Client + Amount */}
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                          className="h-4 w-4 mt-0.5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{invoice.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(invoice.fecha).toLocaleDateString('es-CO')} · {invoice.servicio || invoice.concepto || `#${invoice.invoiceNumber.substring(0, 8)}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm">
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(invoice.totalAmount)}
                          </p>
                          {invoice.paidAmount > 0 && (
                            <p className={`text-xs font-medium ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                              Saldo: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(saldo)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Status + Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <Select
                          value={invoice.status || 'pendiente'}
                          onValueChange={(value) => handleStatusChange(invoice.id, value as 'pendiente' | 'enviada' | 'parcial' | 'pagada')}
                        >
                          <SelectTrigger className="w-auto h-7 px-2 text-xs">
                            <SelectValue>
                              <Badge className={cn("gap-1 text-xs", status.color)}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
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
                            <SelectItem value="parcial">
                              <div className="flex items-center gap-2">
                                <Banknote className="h-3 w-3 text-orange-600" />
                                Abono Parcial
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

                        <div className="flex items-center gap-0.5">
                          {invoice.status !== 'pagada' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAbonoDialog(invoice)}
                              className="text-orange-600 border-orange-300 h-7 px-2 text-xs"
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1" />
                              Abono
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => hasPayments ? openPaymentsHistory(invoice) : undefined}
                            className={`h-7 w-7 p-0 ${hasPayments ? 'text-blue-600' : 'text-muted-foreground/30 cursor-default'}`}
                            disabled={!hasPayments}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(invoice.id)}
                            className="h-7 w-7 p-0"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(invoice.id)}
                            className="h-7 w-7 p-0 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Confirmación de Pago */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Pago</DialogTitle>
            <DialogDescription>
              ¿Deseas registrar este pago en Google Sheets (Finanzas)?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="registerInSheets"
                checked={registerInSheets}
                onCheckedChange={(checked) => setRegisterInSheets(checked === true)}
              />
              <Label htmlFor="registerInSheets" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Registrar ingreso en Google Sheets
              </Label>
            </div>
            {registerInSheets && (
              <div className="space-y-2">
                <Label htmlFor="paymentCuenta">Cuenta destino</Label>
                <Select value={paymentCuenta} onValueChange={setPaymentCuenta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Principal">Principal</SelectItem>
                    <SelectItem value="Ahorros">Ahorros</SelectItem>
                    <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                    <SelectItem value="Nequi">Nequi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment}>
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Abono Parcial */}
      <Dialog open={abonoDialogOpen} onOpenChange={setAbonoDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Registrar Abono</DialogTitle>
            <DialogDescription>
              {selectedInvoiceForAbono && (
                <>
                  {selectedInvoiceForAbono.clientName} — Cuenta #{selectedInvoiceForAbono.invoiceNumber.substring(0, 12)}
                  <br />
                  <span className="font-medium">
                    Saldo pendiente: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedInvoiceForAbono.totalAmount - (selectedInvoiceForAbono.paidAmount || 0))}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto del Abono *</Label>
              <Input
                type="number"
                placeholder="0"
                value={abonoForm.amount}
                onChange={(e) => setAbonoForm({ ...abonoForm, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={abonoForm.paymentMethod} onValueChange={(v) => setAbonoForm({ ...abonoForm, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="nequi">Nequi</SelectItem>
                  <SelectItem value="daviplata">Daviplata</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                placeholder="Número de transacción"
                value={abonoForm.reference}
                onChange={(e) => setAbonoForm({ ...abonoForm, reference: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Input
                placeholder="Notas adicionales"
                value={abonoForm.notes}
                onChange={(e) => setAbonoForm({ ...abonoForm, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="abonoRegisterInSheets"
                checked={abonoForm.registerInSheets}
                onCheckedChange={(checked) => setAbonoForm({ ...abonoForm, registerInSheets: checked === true })}
              />
              <Label htmlFor="abonoRegisterInSheets" className="text-sm">
                Registrar ingreso en Google Sheets
              </Label>
            </div>

            {abonoForm.registerInSheets && (
              <div className="space-y-2">
                <Label>Cuenta destino</Label>
                <Select value={abonoForm.cuenta} onValueChange={(v) => setAbonoForm({ ...abonoForm, cuenta: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Principal">Principal</SelectItem>
                    <SelectItem value="Ahorros">Ahorros</SelectItem>
                    <SelectItem value="Bancolombia">Bancolombia</SelectItem>
                    <SelectItem value="Nequi">Nequi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbonoDialogOpen(false)} disabled={isSubmittingAbono}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitAbono} disabled={isSubmittingAbono}>
              {isSubmittingAbono ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Registrar Abono
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Historial de Pagos */}
      <Dialog open={paymentsDialogOpen} onOpenChange={setPaymentsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Historial de Abonos</DialogTitle>
            <DialogDescription>
              {selectedInvoicePayments && (
                <>
                  {selectedInvoicePayments.clientName} — Cuenta #{selectedInvoicePayments.invoiceNumber.substring(0, 12)}
                  <br />
                  Total: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedInvoicePayments.totalAmount)}
                  {' | '}Abonado: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedInvoicePayments.paidAmount || 0)}
                  {' | '}Saldo: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedInvoicePayments.totalAmount - (selectedInvoicePayments.paidAmount || 0))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoicePayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay abonos registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicePayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(payment.paidAt).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(payment.amount)}
                      </TableCell>
                      <TableCell className="capitalize">{payment.paymentMethod || '—'}</TableCell>
                      <TableCell>{payment.reference || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-destructive hover:text-destructive"
                          title="Eliminar abono"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
