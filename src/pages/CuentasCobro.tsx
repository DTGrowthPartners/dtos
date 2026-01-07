import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Download, FileText, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { saveAs } from 'file-saver';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  fecha: string;
  concepto: string | null;
  servicio: string | null;
  createdAt: string;
}

const CuentasCobro = () => {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const [invoiceData, setInvoiceData] = useState({
    cliente_id: '',
    nombre_cliente: '',
    identificacion: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: 'Prestación de servicios profesionales de marketing digital y desarrollo de software',
    servicio_proyecto: '',
    observaciones: 'No responsable de IVA. Cuenta de cobro emitida bajo el régimen de tributación simplificada.',
  });

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([
    { id: 1, descripcion: '', cantidad: 1, precio_unitario: 0 },
  ]);

  // --- Data Fetching ---
  useEffect(() => {
    fetchData();
  }, [toast]);

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

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setInvoiceData({
        ...invoiceData,
        cliente_id: clientId,
        nombre_cliente: client.name,
        identificacion: client.nit || '',
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
        .filter(item => item.descripcion.trim() !== '') // Filter out empty descriptions
        .map(({ id, ...rest }) => rest), // Remove id from items
    };

    try {
      // Get the auth token
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // Make a direct fetch request to handle blob response
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
        title: 'Éxito',
        description: 'La cuenta de cobro se ha generado y abierta en una nueva pestaña.',
      });

      // Reload invoices list
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

  const handleView = async (invoiceId: string, invoiceNumber: string) => {
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
    if (!confirm('¿Estás seguro de eliminar esta cuenta de cobro?')) return;

    try {
      await apiClient.delete(`/api/invoices/${invoiceId}`);
      toast({
        title: 'Eliminado',
        description: 'La cuenta de cobro se eliminó correctamente.',
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
    if (!confirm(`¿Estás seguro de eliminar ${count} cuenta(s) de cobro?`)) return;

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
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">Generar Cuenta de Cobro</h1>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cliente_id">Cliente</Label>
              <Select onValueChange={handleClientChange} value={invoiceData.cliente_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identificacion">Identificación (NIT/CC)</Label>
              <Input id="identificacion" name="identificacion" value={invoiceData.identificacion} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" value={invoiceData.fecha} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servicio_proyecto">Servicio / Proyecto</Label>
              <Input id="servicio_proyecto" name="servicio_proyecto" value={invoiceData.servicio_proyecto} onChange={handleInputChange} placeholder="Ej: Mantenimiento Web" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="concepto">Observaciones</Label>
              <Textarea id="concepto" name="concepto" value={invoiceData.concepto} onChange={handleInputChange} rows={2} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observaciones">Concepto General</Label>
              <Textarea id="observaciones" name="observaciones" value={invoiceData.observaciones} onChange={handleInputChange} rows={3} />
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
              {serviceItems.map((item, index) => (
                <div key={item.id} className="flex flex-col md:flex-row items-center gap-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-grow w-full">
                    <div className="space-y-2">
                      <Label>Seleccionar Servicio</Label>
                      <Select onValueChange={(serviceId) => {
                        const service = services.find(s => s.id === serviceId);
                        if (service) {
                          handleServiceItemChange(item.id, 'descripcion', service.description || service.name);
                          handleServiceItemChange(item.id, 'precio_unitario', service.price);
                        }
                      }}>
                        <SelectTrigger>
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
                    <div className="space-y-2 md:col-span-2">
                      <Label>Descripción</Label>
                      <Input
                        placeholder="Descripción del servicio"
                        value={item.descripcion}
                        onChange={(e) => handleServiceItemChange(item.id, 'descripcion', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        placeholder="1"
                        value={item.cantidad}
                        onChange={(e) => handleServiceItemChange(item.id, 'cantidad', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={item.precio_unitario}
                        onChange={(e) => handleServiceItemChange(item.id, 'precio_unitario', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <Input
                        value={new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(calculateTotal(item))}
                        readOnly
                        disabled
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeServiceItem(item.id)}
                    className="mt-4 md:mt-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={addServiceItem} className="mt-4">
              <PlusCircle className="h-4 w-4 mr-2" />
              Añadir Ítem
            </Button>
          </CardContent>
          <CardFooter className="flex justify-end font-bold text-xl pr-6">
            Total General: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(grandTotal)}
          </CardFooter>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Generando...' : 'Generar Cuenta de Cobro'}
          </Button>
        </div>
      </form>

      {/* Cuentas Generadas */}
      <Card className="mt-8">
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
                  <TableHead>N° Cuenta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
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
                      #{invoice.invoiceNumber.substring(0, 12)}...
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.fecha).toLocaleDateString('es-CO')}
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(invoice.id, invoice.invoiceNumber)}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CuentasCobro;