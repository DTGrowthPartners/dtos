import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Check, ChevronsUpDown, ShieldCheck, Loader2, CircleCheck, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
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
import { MUNICIPIOS_DANE } from '@/lib/municipiosDane';

export interface FactusInvoiceLike {
  id: string;
  clientId: string;
  clientName: string;
  clientNit: string;
  totalAmount: number;
  concepto: string | null;
  servicio: string | null;
  factusNumber?: string | null;
  factusCufe?: string | null;
  factusStatus?: string | null;
  factusNcNumber?: string | null;
}

interface FactusResult {
  ok: boolean;
  sandbox: boolean;
  number: string;
  cufe: string | null;
  total: string | number;
  validated: boolean;
  notificaciones: string[];
}

interface FactusEstado {
  ok: boolean;
  configurado: boolean;
  sandbox: boolean;
  mensaje?: string;
  rangos?: { id: number; documento: string; prefijo: string; actual: number; resolucion: string | null }[];
}

// Cuentas propias de DT Growth (el backend las traduce al código DIAN)
const MEDIOS_PAGO_FACTUS = [
  { c: 'bancolombia', n: 'Cuenta de ahorros Bancolombia: 78841707710' },
  { c: 'nequi', n: 'Nequi: 3007189383' },
  { c: 'daviplata', n: 'Daviplata: 3007189383' },
  { c: 'breb', n: 'Bre-B: 1143397563' },
  { c: 'efectivo', n: 'Efectivo' },
];

interface FactusDialogProps {
  invoice: FactusInvoiceLike | null;
  onClose: () => void;
  clientMunicipio?: string | null;
  clientEmail?: string | null;
  onSuccess: () => void; // refetch de la lista en el padre
}

export function FactusDialog({ invoice, onClose, clientMunicipio, clientEmail, onSuccess }: FactusDialogProps) {
  const { toast } = useToast();
  const [factusIva, setFactusIva] = useState<'0' | '19'>('0');
  const [factusPersona, setFactusPersona] = useState<'auto' | 'juridica' | 'natural'>('auto');
  const [factusLoading, setFactusLoading] = useState(false);
  const [factusResult, setFactusResult] = useState<FactusResult | null>(null);
  const [factusError, setFactusError] = useState<string | null>(null);
  const [factusEstado, setFactusEstado] = useState<FactusEstado | null>(null);
  const [factusMunicipio, setFactusMunicipio] = useState('08001');
  const [factusMedioPago, setFactusMedioPago] = useState('bancolombia');
  const [factusMuniOpen, setFactusMuniOpen] = useState(false);
  const [factusMuniQuery, setFactusMuniQuery] = useState('');
  const [correoDestino, setCorreoDestino] = useState('');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  // Reset del formulario cada vez que se abre para una factura distinta
  useEffect(() => {
    if (!invoice) return;
    setFactusIva('0');
    setFactusPersona('auto');
    setFactusResult(null);
    setFactusError(null);
    setFactusMuniQuery('');
    setFactusMedioPago('bancolombia');
    setFactusMunicipio(clientMunicipio || '08001');
    setCorreoDestino(clientEmail || '');
    apiClient.get<FactusEstado>('/api/factus/estado').then(setFactusEstado).catch(() => setFactusEstado(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  const muniLabel = (code: string) => {
    const m = MUNICIPIOS_DANE.find((x) => x.c === code);
    return m ? `${m.n} (${m.d})` : code;
  };
  const munisFiltrados = useMemo(() => {
    const q = factusMuniQuery.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return MUNICIPIOS_DANE.slice(0, 30);
    return MUNICIPIOS_DANE.filter((m) =>
      `${m.n} ${m.d}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)
    ).slice(0, 30);
  }, [factusMuniQuery]);

  // Producción sin rango de numeración activo para facturas → no se puede emitir todavía
  const factusSinRango = factusEstado?.ok === true && !factusEstado.sandbox &&
    !(factusEstado.rangos || []).some((r) => /factura/i.test(r.documento));

  const handleFactusEmitir = async () => {
    if (!invoice) return;
    if (factusEstado && !factusEstado.sandbox) {
      const okConfirm = confirm(
        `Vas a emitir una factura electrónica REAL ante la DIAN por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)} a nombre de ${invoice.clientName}. ¿Continuar?`
      );
      if (!okConfirm) return;
    }
    setFactusLoading(true);
    setFactusError(null);
    try {
      const result = await apiClient.post<FactusResult>(`/api/factus/emitir/${invoice.id}`, {
        ivaPct: Number(factusIva),
        municipio: factusMunicipio,
        medioPago: factusMedioPago,
        ...(factusPersona !== 'auto' ? { tipoPersona: factusPersona } : {}),
      });
      setFactusResult(result);
      toast({
        title: 'Factura electrónica emitida',
        description: `${result.number} — validada ante la DIAN${result.sandbox ? ' (sandbox)' : ''}`,
      });
      onSuccess();
    } catch (error) {
      setFactusError(error instanceof Error ? error.message : 'No se pudo emitir la factura');
    } finally {
      setFactusLoading(false);
    }
  };

  const handleFactusAnular = async () => {
    if (!invoice?.factusNumber) return;
    const motivo = prompt(
      `Vas a ANULAR la factura ${invoice.factusNumber} con una nota crédito (es el mecanismo legal — la factura no se puede borrar).\n\nMotivo de la anulación:`
    );
    if (motivo === null) return;
    setFactusLoading(true);
    setFactusError(null);
    try {
      const r = await apiClient.post<{ ncNumber: string }>(`/api/factus/anular/${invoice.id}`, { motivo });
      toast({ title: 'Factura anulada', description: `Nota crédito ${r.ncNumber} validada ante la DIAN` });
      onSuccess();
      onClose();
    } catch (error) {
      setFactusError(error instanceof Error ? error.message : 'No se pudo anular');
    } finally {
      setFactusLoading(false);
    }
  };

  const handleFactusNotaDebito = async () => {
    if (!invoice?.factusNumber) return;
    const valorStr = prompt(
      `Nota débito sobre ${invoice.factusNumber}: cobra un valor ADICIONAL al cliente (intereses de mora, gastos, valor facturado de menos).\n\nValor a cobrar (solo números):`
    );
    if (valorStr === null) return;
    const valor = Number(valorStr.replace(/[^\d.]/g, ''));
    if (!valor || valor <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    const motivo = prompt('Motivo del cobro (sale como concepto en la nota débito):');
    if (!motivo?.trim()) return;
    setFactusLoading(true);
    setFactusError(null);
    try {
      const r = await apiClient.post<{ ndNumber: string; valor: number }>(`/api/factus/nota-debito/${invoice.id}`, { valor, motivo });
      toast({
        title: 'Nota débito emitida',
        description: `${r.ndNumber} por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(r.valor)} — validada ante la DIAN`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      setFactusError(error instanceof Error ? error.message : 'No se pudo emitir la nota débito');
    } finally {
      setFactusLoading(false);
    }
  };

  const handleFactusPdf = async (invoiceId: string, propio = false) => {
    try {
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/factus/${propio ? 'pdf-propio' : 'pdf'}/${invoiceId}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
      if (!response.ok) throw new Error('No se pudo descargar el PDF');
      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast({ title: 'Error', description: 'No se pudo abrir el PDF de la factura electrónica.', variant: 'destructive' });
    }
  };

  const handleEnviarCorreo = async () => {
    if (!invoice) return;
    const correo = correoDestino.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      toast({ title: 'Correo inválido', description: 'Escribe un correo válido para enviar la factura.', variant: 'destructive' });
      return;
    }
    setEnviandoCorreo(true);
    try {
      await apiClient.post(`/api/factus/enviar-correo/${invoice.id}`, { email: correo });
      toast({ title: 'Correo enviado', description: `PDF y XML enviados a ${correo}.` });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo enviar el correo.',
        variant: 'destructive',
      });
    } finally {
      setEnviandoCorreo(false);
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Factura electrónica DIAN
          </DialogTitle>
          <DialogDescription>
            Emite esta factura como factura electrónica vía Factus.
          </DialogDescription>
        </DialogHeader>

        {!invoice?.factusNumber && ((!factusEstado || factusEstado.sandbox) ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Modo <strong>sandbox de pruebas</strong>: las facturas emitidas aquí no tienen validez fiscal
            y no se envían por correo al cliente.
          </div>
        ) : (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            Modo <strong>PRODUCCIÓN</strong>: la factura se emite de verdad ante la DIAN y tiene
            validez fiscal. No se envía correo al cliente (el envío es manual por ahora).
          </div>
        ))}
        {factusSinRango && !invoice?.factusNumber && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Falta el rango de numeración:</strong> la DIAN aún no tiene autorizada la numeración
            de facturación electrónica para este software. Hay que solicitarla en el portal DIAN y
            registrarla en Factus antes de poder emitir.
          </div>
        )}

        {invoice && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3">
              <div className="text-muted-foreground">Cliente</div>
              <div className="font-medium">{invoice.clientName}</div>
              <div className="text-muted-foreground">NIT / ID</div>
              <div>{invoice.clientNit || '—'}</div>
              <div className="text-muted-foreground">Valor</div>
              <div className="font-medium">
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(invoice.totalAmount)}
              </div>
              <div className="text-muted-foreground">Concepto</div>
              <div className="line-clamp-2">{invoice.concepto || invoice.servicio || '—'}</div>
            </div>

            {/* Ya emitida: resumen limpio en vez del formulario */}
            {invoice.factusNumber && !factusResult && invoice.factusStatus !== 'anulada' && (
              <div className="space-y-1.5 rounded-md border border-emerald-300 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 font-medium text-emerald-800">
                  <CircleCheck className="h-4 w-4" />
                  {invoice.factusNumber} — emitida y validada ante la DIAN
                </div>
                {invoice.factusCufe && (
                  <div className="break-all text-[11px] text-emerald-700">CUFE: {invoice.factusCufe}</div>
                )}
              </div>
            )}

            {!factusResult && !invoice.factusNumber && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">IVA</Label>
                  <Select value={factusIva} onValueChange={(v) => setFactusIva(v as '0' | '19')}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sin IVA (no responsable)</SelectItem>
                      <SelectItem value="19">IVA 19%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de cliente</Label>
                  <Select value={factusPersona} onValueChange={(v) => setFactusPersona(v as typeof factusPersona)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Detectar por NIT</SelectItem>
                      <SelectItem value="juridica">Persona jurídica</SelectItem>
                      <SelectItem value="natural">Persona natural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Medio de pago</Label>
                  <Select value={factusMedioPago} onValueChange={setFactusMedioPago}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEDIOS_PAGO_FACTUS.map((m) => (
                        <SelectItem key={m.c} value={m.c}>{m.n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Cómo pagó (o pagará) el cliente — sale en la factura como "Detalles de pago".
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Municipio del cliente</Label>
                  <Popover open={factusMuniOpen} onOpenChange={setFactusMuniOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="h-9 w-full justify-between font-normal">
                        {muniLabel(factusMunicipio)}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar municipio..."
                          value={factusMuniQuery}
                          onValueChange={setFactusMuniQuery}
                        />
                        <CommandList>
                          <CommandEmpty>Sin resultados</CommandEmpty>
                          <CommandGroup>
                            {munisFiltrados.map((m) => (
                              <CommandItem
                                key={m.c}
                                value={m.c}
                                onSelect={() => { setFactusMunicipio(m.c); setFactusMuniOpen(false); }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', factusMunicipio === m.c ? 'opacity-100' : 'opacity-0')} />
                                {m.n} <span className="ml-1 text-muted-foreground">({m.d})</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Queda guardado en la ficha del cliente para las próximas facturas.
                  </p>
                </div>
              </div>
            )}

            {factusError && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
                {factusError}
              </div>
            )}

            {factusResult && (
              <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 font-medium text-emerald-800">
                  <CircleCheck className="h-4 w-4" />
                  {factusResult.number} — {factusResult.validated ? 'validada ante la DIAN' : 'registrada (pendiente)'}
                </div>
                {factusResult.cufe && (
                  <div className="break-all text-[11px] text-emerald-700">CUFE: {factusResult.cufe}</div>
                )}
                {factusResult.notificaciones.length > 0 && (
                  <div className="space-y-1 text-[11px] text-amber-700">
                    {factusResult.notificaciones.map((n, i) => (
                      <div key={i}>⚠ {n}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {invoice.factusStatus === 'anulada' && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                Factura <strong>anulada</strong> con la nota crédito {invoice.factusNcNumber}.
              </div>
            )}

            {(invoice.factusNumber || factusResult) && (
              <div>
                <Label className="text-xs">Enviar PDF y XML por correo</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    type="email"
                    value={correoDestino}
                    onChange={(e) => setCorreoDestino(e.target.value)}
                    placeholder="correo@cliente.com"
                    className="h-9"
                  />
                  <Button
                    variant="outline"
                    onClick={handleEnviarCorreo}
                    disabled={enviandoCorreo || !correoDestino.trim()}
                    className="shrink-0"
                  >
                    {enviandoCorreo
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Mail className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Precargado con el correo del cliente; puedes cambiarlo antes de enviar.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {invoice.factusNumber && invoice.factusStatus !== 'anulada' && !factusResult && (
                <>
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleFactusAnular}
                    disabled={factusLoading}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Anular (nota crédito)
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                    onClick={handleFactusNotaDebito}
                    disabled={factusLoading}
                    title="Cobrar un valor adicional sobre esta factura (intereses, gastos, diferencia)"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nota débito
                  </Button>
                </>
              )}
              {(invoice.factusNumber || factusResult) && (
                <>
                  <Button variant="outline" onClick={() => handleFactusPdf(invoice.id, true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF DT Growth
                  </Button>
                  <Button variant="outline" onClick={() => handleFactusPdf(invoice.id)}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF DIAN
                  </Button>
                </>
              )}
              {!factusResult && !invoice.factusNumber && (
                <Button onClick={handleFactusEmitir} disabled={factusLoading || factusSinRango}>
                  {factusLoading
                    ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Emitiendo…</>)
                    : (<><ShieldCheck className="mr-2 h-4 w-4" />
                        {(!factusEstado || factusEstado.sandbox) ? 'Emitir en sandbox' : 'Emitir factura DIAN'}
                      </>)}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
