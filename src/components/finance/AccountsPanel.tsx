import { useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Check,
  Clock,
  Edit,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Trash2,
  X,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { convertImageToBase64 } from '@/lib/imageService';

interface Client {
  id: string;
  name: string;
  logo?: string;
}

interface Account {
  id: string;
  type: 'receivable' | 'payable';
  entityName: string;
  entityLogo?: string;
  clientId?: string;
  client?: Client;
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
  payments: Payment[];
  _count?: { payments: number };
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  paidAt: string;
  status: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

interface AccountsSummary {
  receivables: {
    total: number;
    count: number;
    upcoming: { id: string; amount: number; nextDueDate: string; entityName: string }[];
  };
  payables: {
    total: number;
    count: number;
    upcoming: { id: string; amount: number; nextDueDate: string; entityName: string }[];
  };
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
  'Servicios',
  'Software/Herramientas',
  'Salarios',
  'Marketing/Publicidad',
  'Arriendo',
  'Servidores/Hosting',
  'Freelancers',
  'Otros',
];

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<Account | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    type: 'receivable' as 'receivable' | 'payable',
    entityName: '',
    entityLogo: '',
    clientId: '',
    amount: '',
    currency: 'COP',
    isRecurring: false,
    frequency: 'monthly',
    frequencyDays: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    concept: '',
    category: '',
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paidAt: new Date().toISOString().split('T')[0],
    paymentMethod: 'transferencia',
    reference: '',
    notes: '',
    registerInSheets: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [accountsData, summaryData, clientsData] = await Promise.all([
        apiClient.get<Account[]>('/api/accounts'),
        apiClient.get<AccountsSummary>('/api/accounts/summary'),
        apiClient.get<Client[]>('/api/clients'),
      ]);
      setAccounts(accountsData);
      setSummary(summaryData);
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching accounts:', error);
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
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        frequencyDays: formData.frequencyDays ? parseInt(formData.frequencyDays) : undefined,
        clientId: formData.clientId || undefined,
        endDate: formData.endDate || undefined,
      };

      if (editingAccount) {
        await apiClient.put(`/api/accounts/${editingAccount.id}`, data);
        toast({ title: 'Cuenta actualizada', description: 'La cuenta se actualizó correctamente' });
      } else {
        await apiClient.post('/api/accounts', data);
        toast({ title: 'Cuenta creada', description: 'La cuenta se creó correctamente' });
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForPayment) return;

    try {
      await apiClient.post(`/api/accounts/${selectedAccountForPayment.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        paidAt: paymentForm.paidAt,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        registerInSheets: paymentForm.registerInSheets,
      });

      toast({
        title: selectedAccountForPayment.type === 'receivable' ? 'Cobro registrado' : 'Pago registrado',
        description: paymentForm.registerInSheets
          ? 'Se registró en la base de datos y en Google Sheets'
          : 'Se registró en la base de datos',
      });

      setIsPaymentDialogOpen(false);
      resetPaymentForm();
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta?')) return;

    try {
      await apiClient.delete(`/api/accounts/${id}`);
      toast({ title: 'Cuenta eliminada', description: 'La cuenta se eliminó correctamente' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      type: account.type,
      entityName: account.entityName,
      entityLogo: account.entityLogo || '',
      clientId: account.clientId || '',
      amount: String(account.amount),
      currency: account.currency,
      isRecurring: account.isRecurring,
      frequency: account.frequency || 'monthly',
      frequencyDays: account.frequencyDays ? String(account.frequencyDays) : '',
      startDate: account.startDate.split('T')[0],
      endDate: account.endDate ? account.endDate.split('T')[0] : '',
      concept: account.concept,
      category: account.category || '',
      notes: account.notes || '',
    });
    setIsDialogOpen(true);
  };

  const openPaymentDialog = (account: Account) => {
    setSelectedAccountForPayment(account);
    setPaymentForm({
      amount: String(account.amount),
      paidAt: new Date().toISOString().split('T')[0],
      paymentMethod: 'transferencia',
      reference: '',
      notes: '',
      registerInSheets: true,
    });
    setIsPaymentDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAccount(null);
    setFormData({
      type: activeTab,
      entityName: '',
      entityLogo: '',
      clientId: '',
      amount: '',
      currency: 'COP',
      isRecurring: false,
      frequency: 'monthly',
      frequencyDays: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      concept: '',
      category: '',
      notes: '',
    });
  };

  const resetPaymentForm = () => {
    setSelectedAccountForPayment(null);
    setPaymentForm({
      amount: '',
      paidAt: new Date().toISOString().split('T')[0],
      paymentMethod: 'transferencia',
      reference: '',
      notes: '',
      registerInSheets: true,
    });
  };

  const formatCurrency = (amount: number, currency = 'COP') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (nextDueDate?: string) => {
    if (!nextDueDate) return false;
    return new Date(nextDueDate) < new Date();
  };

  const filteredAccounts = accounts.filter((a) => a.type === activeTab && a.status === 'active');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <ArrowDownCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Por Cobrar</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(summary?.receivables.total || 0)}
              </p>
              <p className="text-xs text-muted-foreground">{summary?.receivables.count || 0} cuentas activas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ArrowUpCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Por Pagar</p>
              <p className="text-xl font-bold text-destructive">
                {formatCurrency(summary?.payables.total || 0)}
              </p>
              <p className="text-xs text-muted-foreground">{summary?.payables.count || 0} cuentas activas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${(summary?.balance || 0) >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <Building2 className={`h-5 w-5 ${(summary?.balance || 0) >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className={`text-xl font-bold ${(summary?.balance || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(summary?.balance || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Cobrar - Pagar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'receivable' | 'payable')}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="receivable" className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Por Cobrar ({accounts.filter((a) => a.type === 'receivable' && a.status === 'active').length})
            </TabsTrigger>
            <TabsTrigger value="payable" className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Por Pagar ({accounts.filter((a) => a.type === 'payable' && a.status === 'active').length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button
              size="sm"
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
        </div>

        <TabsContent value="receivable" className="mt-4">
          <AccountsList
            accounts={filteredAccounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPayment={openPaymentDialog}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            isOverdue={isOverdue}
            type="receivable"
          />
        </TabsContent>

        <TabsContent value="payable" className="mt-4">
          <AccountsList
            accounts={filteredAccounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPayment={openPaymentDialog}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            isOverdue={isOverdue}
            type="payable"
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Editar Cuenta' : `Nueva Cuenta ${formData.type === 'receivable' ? 'por Cobrar' : 'por Pagar'}`}
            </DialogTitle>
            <DialogDescription>
              {formData.type === 'receivable'
                ? 'Define un cobro recurrente o único a un cliente'
                : 'Define un pago recurrente o único a un proveedor'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Logo y Entidad */}
              <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/50 flex-shrink-0">
                  {formData.entityLogo ? (
                    <>
                      <img src={formData.entityLogo} alt="Logo" className="h-full w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, entityLogo: '' })}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full hover:bg-muted/80 transition-colors">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const base64 = await convertImageToBase64(file);
                            setFormData({ ...formData, entityLogo: base64 });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label>
                    {formData.type === 'receivable' ? 'Cliente / Entidad' : 'Proveedor / Entidad'} *
                  </Label>
                  {formData.type === 'receivable' ? (
                    <Select
                      value={formData.clientId}
                      onValueChange={(value) => {
                        const client = clients.find((c) => c.id === value);
                        setFormData({
                          ...formData,
                          clientId: value,
                          entityName: client?.name || '',
                          entityLogo: client?.logo || formData.entityLogo,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Otro (escribir nombre)</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Nombre del proveedor"
                      value={formData.entityName}
                      onChange={(e) => setFormData({ ...formData, entityName: e.target.value })}
                      required
                    />
                  )}
                  {formData.clientId === 'custom' && formData.type === 'receivable' && (
                    <Input
                      placeholder="Nombre del cliente"
                      value={formData.entityName}
                      onChange={(e) => setFormData({ ...formData, entityName: e.target.value })}
                      required
                    />
                  )}
                </div>
              </div>

              {/* Concepto */}
              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  placeholder="Ej: Servicio de marketing mensual"
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                  required
                />
              </div>

              {/* Monto y Moneda */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <Input
                    type="number"
                    placeholder="700000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
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

              {/* Recurrencia */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Pago Recurrente</p>
                  <p className="text-xs text-muted-foreground">Se repite automáticamente</p>
                </div>
                <Switch
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
                />
              </div>

              {formData.isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frecuencia</Label>
                    <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.frequency === 'custom' && (
                    <div className="space-y-2">
                      <Label>Cada X días</Label>
                      <Input
                        type="number"
                        placeholder="15"
                        value={formData.frequencyDays}
                        onChange={(e) => setFormData({ ...formData, frequencyDays: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Inicio *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                {formData.isRecurring && (
                  <div className="space-y-2">
                    <Label>Fecha Fin (opcional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingAccount ? 'Actualizar' : 'Crear'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAccountForPayment?.type === 'receivable' ? 'Registrar Cobro' : 'Registrar Pago'}
            </DialogTitle>
            <DialogDescription>
              {selectedAccountForPayment?.entityName} - {selectedAccountForPayment?.concept}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePayment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="nequi">Nequi</SelectItem>
                    <SelectItem value="daviplata">Daviplata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input
                  placeholder="Número de transacción"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div>
                  <p className="font-medium text-sm">Registrar en Google Sheets</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAccountForPayment?.type === 'receivable'
                      ? 'Se agregará como entrada en Finanzas'
                      : 'Se agregará como salida en Finanzas'}
                  </p>
                </div>
                <Switch
                  checked={paymentForm.registerInSheets}
                  onCheckedChange={(checked) => setPaymentForm({ ...paymentForm, registerInSheets: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                <Check className="h-4 w-4 mr-2" />
                {selectedAccountForPayment?.type === 'receivable' ? 'Registrar Cobro' : 'Registrar Pago'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for accounts list
function AccountsList({
  accounts,
  onEdit,
  onDelete,
  onPayment,
  formatCurrency,
  formatDate,
  isOverdue,
  type,
}: {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onPayment: (account: Account) => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: string) => string;
  isOverdue: (date?: string) => boolean;
  type: 'receivable' | 'payable';
}) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay cuentas {type === 'receivable' ? 'por cobrar' : 'por pagar'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div
          key={account.id}
          className={`rounded-xl border p-4 transition-all hover:shadow-md ${
            isOverdue(account.nextDueDate) ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {account.entityLogo || account.client?.logo ? (
                <img
                  src={account.entityLogo || account.client?.logo}
                  alt=""
                  className="h-10 w-10 rounded-lg object-contain bg-muted p-1"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{account.client?.name || account.entityName}</p>
                <p className="text-sm text-muted-foreground truncate">{account.concept}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right">
                <p className={`font-bold ${type === 'receivable' ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(account.amount, account.currency)}
                </p>
                {account.isRecurring && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCcw className="h-3 w-3" />
                    <span>
                      {account.frequency === 'custom' && account.frequencyDays
                        ? `Cada ${account.frequencyDays} días`
                        : FREQUENCIES.find((f) => f.value === account.frequency)?.label}
                    </span>
                  </div>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onPayment(account)}>
                    <Check className="h-4 w-4 mr-2" />
                    {type === 'receivable' ? 'Registrar Cobro' : 'Registrar Pago'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(account)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(account.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Due date and badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {account.nextDueDate && (
              <Badge
                variant={isOverdue(account.nextDueDate) ? 'destructive' : 'secondary'}
                className="flex items-center gap-1"
              >
                {isOverdue(account.nextDueDate) ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Calendar className="h-3 w-3" />
                )}
                {isOverdue(account.nextDueDate) ? 'Vencido: ' : 'Próximo: '}
                {formatDate(account.nextDueDate)}
              </Badge>
            )}
            {account.category && (
              <Badge variant="outline">{account.category}</Badge>
            )}
            {account._count && account._count.payments > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {account._count.payments} pago(s)
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AccountsPanel;
