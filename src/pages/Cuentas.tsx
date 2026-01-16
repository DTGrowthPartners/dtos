import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  DollarSign,
  RefreshCcw,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  ImagePlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { convertImageToBase64 } from '@/lib/imageService';

interface Account {
  id: string;
  type: 'receivable' | 'payable';
  entityName: string;
  entityLogo?: string;
  clientId?: string;
  client?: { id: string; name: string; logo: string };
  amount: number;
  currency: string;
  isRecurring: boolean;
  frequency?: string;
  frequencyDays?: number;
  startDate: string;
  nextDueDate?: string;
  endDate?: string;
  concept: string;
  category?: string;
  status: string;
  notes?: string;
  payments?: AccountPayment[];
  _count?: { payments: number };
  createdAt: string;
}

interface AccountPayment {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  dueDate?: string;
  status: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

interface Summary {
  receivables: { total: number; count: number; upcoming: any[] };
  payables: { total: number; count: number; upcoming: any[] };
  balance: number;
}

const FREQUENCIES = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
  { value: 'custom', label: 'Personalizado' },
];

const CATEGORIES = [
  { value: 'servicios', label: 'Servicios' },
  { value: 'software', label: 'Software/Licencias' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'salarios', label: 'Salarios' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'otro', label: 'Otro' },
];

const PAYMENT_METHODS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];

export default function Cuentas() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    type: 'receivable' as 'receivable' | 'payable',
    entityName: '',
    entityLogo: '',
    amount: '',
    currency: 'COP',
    isRecurring: false,
    frequency: '',
    frequencyDays: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    concept: '',
    category: '',
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'transferencia',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [accountsData, summaryData] = await Promise.all([
        apiClient.get<Account[]>('/api/accounts'),
        apiClient.get<Summary>('/api/accounts/summary'),
      ]);
      setAccounts(accountsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las cuentas',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.entityName || !formData.amount || !formData.concept) {
      toast({
        title: 'Error',
        description: 'Completa los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        frequencyDays: formData.frequencyDays ? parseInt(formData.frequencyDays) : undefined,
      };

      if (editingAccount) {
        await apiClient.put(`/api/accounts/${editingAccount.id}`, data);
        toast({ title: 'Cuenta actualizada' });
      } else {
        await apiClient.post('/api/accounts', data);
        toast({ title: 'Cuenta creada' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la cuenta',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta?')) return;

    try {
      await apiClient.delete(`/api/accounts/${id}`);
      toast({ title: 'Cuenta eliminada' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta',
        variant: 'destructive',
      });
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !paymentData.amount) return;

    try {
      await apiClient.post(`/api/accounts/${selectedAccount.id}/payments`, {
        amount: parseFloat(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        reference: paymentData.reference,
        notes: paymentData.notes,
        dueDate: selectedAccount.nextDueDate,
      });
      toast({ title: 'Pago registrado' });
      setIsPaymentDialogOpen(false);
      setPaymentData({ amount: '', paymentMethod: 'transferencia', reference: '', notes: '' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago',
        variant: 'destructive',
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await convertImageToBase64(file);
      setFormData({ ...formData, entityLogo: base64 });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la imagen',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      type: activeTab,
      entityName: '',
      entityLogo: '',
      amount: '',
      currency: 'COP',
      isRecurring: false,
      frequency: '',
      frequencyDays: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      concept: '',
      category: '',
      notes: '',
    });
    setEditingAccount(null);
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      type: account.type,
      entityName: account.entityName,
      entityLogo: account.entityLogo || '',
      amount: account.amount.toString(),
      currency: account.currency,
      isRecurring: account.isRecurring,
      frequency: account.frequency || '',
      frequencyDays: account.frequencyDays?.toString() || '',
      startDate: account.startDate.split('T')[0],
      endDate: account.endDate?.split('T')[0] || '',
      concept: account.concept,
      category: account.category || '',
      notes: account.notes || '',
    });
    setIsDialogOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'COP') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (nextDueDate?: string) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.type === activeTab &&
      (a.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.concept.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const receivablesTotal = accounts
    .filter((a) => a.type === 'receivable' && a.status === 'active')
    .reduce((sum, a) => sum + a.amount, 0);

  const payablesTotal = accounts
    .filter((a) => a.type === 'payable' && a.status === 'active')
    .reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cuentas</h1>
          <p className="text-muted-foreground">Gestiona tus cuentas por cobrar y por pagar</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setFormData((prev) => ({ ...prev, type: activeTab }));
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cuenta
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(receivablesTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {accounts.filter((a) => a.type === 'receivable' && a.status === 'active').length} cuentas activas
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Por Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(payablesTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {accounts.filter((a) => a.type === 'payable' && a.status === 'active').length} cuentas activas
            </p>
          </CardContent>
        </Card>

        <Card className={receivablesTotal - payablesTotal >= 0 ? 'border-blue-200 bg-blue-50/50' : 'border-orange-200 bg-orange-50/50'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${receivablesTotal - payablesTotal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              <DollarSign className="h-4 w-4" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${receivablesTotal - payablesTotal >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {formatCurrency(receivablesTotal - payablesTotal)}
            </p>
            <p className="text-xs text-muted-foreground">Diferencia por cobrar vs pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'receivable' | 'payable')}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="receivable" className="gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Por Cobrar
            </TabsTrigger>
            <TabsTrigger value="payable" className="gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Por Pagar
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="receivable" className="mt-4">
          <AccountsTable
            accounts={filteredAccounts}
            isLoading={isLoading}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            onRegisterPayment={(a) => {
              setSelectedAccount(a);
              setPaymentData({ ...paymentData, amount: a.amount.toString() });
              setIsPaymentDialogOpen(true);
            }}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            isOverdue={isOverdue}
          />
        </TabsContent>

        <TabsContent value="payable" className="mt-4">
          <AccountsTable
            accounts={filteredAccounts}
            isLoading={isLoading}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            onRegisterPayment={(a) => {
              setSelectedAccount(a);
              setPaymentData({ ...paymentData, amount: a.amount.toString() });
              setIsPaymentDialogOpen(true);
            }}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            isOverdue={isOverdue}
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Cuenta' : `Nueva Cuenta ${activeTab === 'receivable' ? 'por Cobrar' : 'por Pagar'}`}
            </DialogTitle>
            <DialogDescription>
              {activeTab === 'receivable'
                ? 'Registra una cuenta por cobrar de un cliente'
                : 'Registra una cuenta por pagar a un proveedor'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo Upload */}
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50">
                {formData.entityLogo ? (
                  <>
                    <img src={formData.entityLogo} alt="Logo" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, entityLogo: '' })}
                      className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="entityName">{activeTab === 'receivable' ? 'Cliente' : 'Proveedor'} *</Label>
                <Input
                  id="entityName"
                  value={formData.entityName}
                  onChange={(e) => setFormData({ ...formData, entityName: e.target.value })}
                  placeholder="Nombre del cliente/proveedor"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Monto *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COP">COP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="concept">Concepto *</Label>
              <Input
                id="concept"
                value={formData.concept}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Descripción del pago"
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Categoría</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isRecurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(v) => setFormData({ ...formData, isRecurring: v })}
                />
                <Label htmlFor="isRecurring" className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Pago recurrente
                </Label>
              </div>
            </div>

            {formData.isRecurring && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label htmlFor="frequency">Frecuencia</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.frequency === 'custom' && (
                  <div>
                    <Label htmlFor="frequencyDays">Cada (días)</Label>
                    <Input
                      id="frequencyDays"
                      type="number"
                      value={formData.frequencyDays}
                      onChange={(e) => setFormData({ ...formData, frequencyDays: e.target.value })}
                      placeholder="15"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Fecha inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              {formData.isRecurring && (
                <div>
                  <Label htmlFor="endDate">Fecha fin (opcional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingAccount ? 'Guardar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedAccount?.entityName} - {selectedAccount?.concept}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterPayment} className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">Monto</Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="paymentMethod">Método de pago</Label>
              <Select value={paymentData.paymentMethod} onValueChange={(v) => setPaymentData({ ...paymentData, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reference">Referencia</Label>
              <Input
                id="reference"
                value={paymentData.reference}
                onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                placeholder="Número de transacción"
              />
            </div>

            <div>
              <Label htmlFor="paymentNotes">Notas</Label>
              <Textarea
                id="paymentNotes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <CheckCircle className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Accounts Table Component
function AccountsTable({
  accounts,
  isLoading,
  onEdit,
  onDelete,
  onRegisterPayment,
  formatCurrency,
  formatDate,
  isOverdue,
}: {
  accounts: Account[];
  isLoading: boolean;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onRegisterPayment: (a: Account) => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: string) => string;
  isOverdue: (date?: string) => boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay cuentas registradas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente/Proveedor</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Próximo Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {account.entityLogo ? (
                      <img src={account.entityLogo} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium">{account.entityName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{account.concept}</p>
                    {account.category && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {CATEGORIES.find((c) => c.value === account.category)?.label || account.category}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(account.amount, account.currency)}
                </TableCell>
                <TableCell>
                  {account.isRecurring ? (
                    <div className="flex items-center gap-1 text-sm">
                      <RefreshCcw className="h-3 w-3" />
                      {account.frequency === 'custom'
                        ? `Cada ${account.frequencyDays} días`
                        : FREQUENCIES.find((f) => f.value === account.frequency)?.label || account.frequency}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Único</span>
                  )}
                </TableCell>
                <TableCell>
                  {account.nextDueDate ? (
                    <div className={`flex items-center gap-1 text-sm ${isOverdue(account.nextDueDate) ? 'text-red-600 font-medium' : ''}`}>
                      {isOverdue(account.nextDueDate) ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Calendar className="h-3 w-3" />
                      )}
                      {formatDate(account.nextDueDate)}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={account.status === 'active' ? 'default' : 'secondary'}
                    className={account.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
                  >
                    {account.status === 'active' ? 'Activo' : account.status === 'completed' ? 'Completado' : account.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRegisterPayment(account)}
                      title="Registrar pago"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(account)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(account.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
