import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Landmark, RefreshCw, ArrowDownLeft, ArrowUpRight, Loader2, CheckCircle2, Clock } from 'lucide-react';

/**
 * Movimientos bancarios en vivo: lo que el monitor de correos de Bancolombia
 * detectó, registró en el Sheets y notificó al grupo de WhatsApp.
 * Fuente: tabla BankTransaction (backend DTOS). Existe desde la migración
 * de api-cuentas-de-cobro (ago 2026); lo anterior vive solo en el Sheets.
 */

interface BankTx {
  id: string;
  tipo: 'entrante' | 'saliente';
  monto: number;
  descripcion: string;
  categoria: string;
  cuenta: string;
  entidad: string;
  fecha: string;
  sheetOk: boolean;
  notificado: boolean;
  createdAt: string;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const BankMovements = () => {
  const [txs, setTxs] = useState<BankTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<'all' | 'entrante' | 'saliente'>('all');

  const fetchTxs = async () => {
    setLoading(true);
    try {
      const q = tipo === 'all' ? '' : `&tipo=${tipo}`;
      setTxs(await apiClient.get<BankTx[]>(`/api/bank/transactions?take=200${q}`));
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchTxs(); }, [tipo]);

  const totalIn = txs.filter((t) => t.tipo === 'entrante').reduce((a, t) => a + t.monto, 0);
  const totalOut = txs.filter((t) => t.tipo === 'saliente').reduce((a, t) => a + t.monto, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-5 w-5 text-primary" />
            Movimientos bancarios (monitor Bancolombia)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrante">Entradas</SelectItem>
                <SelectItem value="saliente">Salidas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={fetchTxs}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Detectados automáticamente del correo del banco y registrados en la hoja de finanzas.
          Entradas: <span className="font-medium text-emerald-600">{money(totalIn)}</span> ·
          Salidas: <span className="font-medium text-amber-600">{money(totalOut)}</span>
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
          </div>
        ) : txs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay movimientos registrados por el monitor (activo desde el 3 de agosto de 2026).
            Los históricos anteriores están en la hoja de finanzas.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3 text-right">Monto</th>
                  <th className="py-2 pl-3">Descripción</th>
                  <th className="py-2 pl-3">Categoría</th>
                  <th className="py-2 pl-3">Entidad</th>
                  <th className="py-2 pl-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{t.fecha.slice(0, 16)}</td>
                    <td className="py-2 pr-3">
                      {t.tipo === 'entrante' ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-800"><ArrowDownLeft className="h-3 w-3" />Entrada</Badge>
                      ) : (
                        <Badge className="gap-1 bg-amber-100 text-amber-800"><ArrowUpRight className="h-3 w-3" />Salida</Badge>
                      )}
                    </td>
                    <td className={cn('whitespace-nowrap py-2 pr-3 text-right font-semibold',
                      t.tipo === 'entrante' ? 'text-emerald-600' : 'text-amber-700')}>
                      {money(t.monto)}
                    </td>
                    <td className="max-w-[280px] truncate py-2 pl-3" title={t.descripcion}>{t.descripcion}</td>
                    <td className="max-w-[180px] truncate py-2 pl-3 text-muted-foreground" title={t.categoria}>{t.categoria}</td>
                    <td className="max-w-[160px] truncate py-2 pl-3 text-muted-foreground">{t.entidad}</td>
                    <td className="whitespace-nowrap py-2 pl-3">
                      <span className="inline-flex items-center gap-1 text-[11px]" title="Registrado en la hoja de finanzas">
                        <CheckCircle2 className={cn('h-3.5 w-3.5', t.sheetOk ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                        Sheets
                      </span>
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px]" title="Aviso enviado al grupo de WhatsApp">
                        {t.notificado
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        WhatsApp
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BankMovements;
