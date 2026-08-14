import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Smile, RefreshCw, Link2, Copy, Loader2, TrendingUp, TrendingDown, Minus,
  MessageSquare, PhoneCall, Send,
} from 'lucide-react';

/** Panel NPS trimestral (spec de Dairo): score global, cuentas con tendencia,
 *  comentarios y generación de links del trimestre. */

interface DetalleResp {
  contacto: string; puntaje: number; comentario: string | null;
  aspectos: string[]; quiereLlamada: boolean; fecha: string;
}
interface Cuenta {
  cliente: string; clienteId: string; promedio: number; clase: string;
  anterior: number | null; detalle: DetalleResp[];
}
interface Resumen {
  trimestre: string; trimestreAnterior: string; enviados: number; cuentasRespondieron: number;
  nps: number | null; promotoras: number; detractoras: number; pasivas: number; cuentas: Cuenta[];
}
interface LinkGen { cliente: string; contacto: string; whatsapp: string | null; estado: string; link: string }

const CLASE_STYLE: Record<string, string> = {
  promotor: 'bg-emerald-100 text-emerald-800',
  pasivo: 'bg-amber-100 text-amber-800',
  detractor: 'bg-red-100 text-red-800',
};

const NpsPanel = () => {
  const { toast } = useToast();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<LinkGen[] | null>(null);
  const [generando, setGenerando] = useState(false);

  const fetchResumen = async () => {
    setLoading(true);
    try { setResumen(await apiClient.get<Resumen>('/api/nps/resumen')); }
    catch { toast({ title: 'Error cargando el NPS', variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchResumen(); }, []);

  const generar = async () => {
    setGenerando(true);
    try {
      const r = await apiClient.post<{ trimestre: string; links: LinkGen[] }>('/api/nps/generar', {});
      setLinks(r.links);
      toast({ title: `Links del ${r.trimestre} listos`, description: `${r.links.length} contactos` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally { setGenerando(false); }
  };

  const copiar = (texto: string, aviso: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: aviso });
  };

  const mensajeWhatsApp = (l: LinkGen) =>
    `Hola ${l.contacto}, cada trimestre le preguntamos lo mismo a todos nuestros clientes para saber cómo vamos. Son 3 preguntas y menos de un minuto 👇\n${l.link}`;

  const npsColor = (n: number | null) =>
    n === null ? 'text-muted-foreground' : n >= 50 ? 'text-emerald-600' : n >= 0 ? 'text-amber-600' : 'text-red-600';

  const Tendencia = ({ c }: { c: Cuenta }) => {
    if (c.anterior === null) return <span className="text-xs text-muted-foreground">—</span>;
    const diff = Math.round((c.promedio - c.anterior) * 10) / 10;
    if (diff > 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><TrendingUp className="h-3.5 w-3.5" />+{diff}</span>;
    if (diff < 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><TrendingDown className="h-3.5 w-3.5" />{diff}</span>;
    return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3.5 w-3.5" />igual</span>;
  };

  return (
    <div className="container mx-auto space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-shrink-0">
          <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <Smile className="h-6 w-6 text-primary" />
            NPS de clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Encuesta trimestral de satisfacción — {resumen?.trimestre || '…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchResumen}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button onClick={generar} disabled={generando}>
            {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Generar links del trimestre
          </Button>
        </div>
      </div>

      {/* Score global */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 text-center">
            <div className={cn('text-4xl font-extrabold', npsColor(resumen?.nps ?? null))}>
              {resumen?.nps ?? '—'}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">NPS</div>
          </CardContent>
        </Card>
        {[
          ['Promotoras', resumen?.promotoras, 'text-emerald-600'],
          ['Pasivas', resumen?.pasivas, 'text-amber-600'],
          ['Detractoras', resumen?.detractoras, 'text-red-600'],
          ['Respuestas', `${resumen?.cuentasRespondieron ?? 0}/${resumen?.enviados ?? 0}`, 'text-foreground'],
        ].map(([lbl, val, cls]) => (
          <Card key={String(lbl)}>
            <CardContent className="p-4 text-center">
              <div className={cn('text-2xl font-bold', String(cls))}>{val ?? 0}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{lbl}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cuentas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cuentas (peor primero) · tendencia vs {resumen?.trimestreAnterior}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !resumen?.cuentas.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay respuestas este trimestre. Genera los links y mándalos por WhatsApp.
            </p>
          ) : resumen.cuentas.map((c) => (
            <div key={c.clienteId} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{c.cliente}</span>
                <Badge className={cn('text-[10px]', CLASE_STYLE[c.clase])}>{c.clase}</Badge>
                <span className="text-lg font-bold">{c.promedio}</span>
                <Tendencia c={c} />
              </div>
              <div className="mt-2 space-y-1.5">
                {c.detalle.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-2 text-sm">
                    <span className={cn('inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      d.puntaje <= 6 ? 'bg-red-100 text-red-700' : d.puntaje <= 8 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                      {d.puntaje}
                    </span>
                    <span className="font-medium">{d.contacto}</span>
                    {d.quiereLlamada && <Badge className="gap-1 bg-red-100 text-[10px] text-red-700"><PhoneCall className="h-3 w-3" />pide llamada</Badge>}
                    {d.aspectos.length > 0 && <span className="text-xs text-muted-foreground">ajustar: {d.aspectos.join(', ')}</span>}
                    {d.comentario && (
                      <span className="flex w-full items-start gap-1.5 pl-8 text-xs italic text-muted-foreground">
                        <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" />“{d.comentario}”
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dialog: links generados */}
      <Dialog open={!!links} onOpenChange={(o) => { if (!o) setLinks(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Links del trimestre</DialogTitle>
            <DialogDescription>Copia el mensaje listo y mándalo por WhatsApp a cada contacto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {links?.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.contacto} <span className="text-muted-foreground">· {l.cliente}</span></div>
                  <div className="truncate text-xs text-muted-foreground">{l.link}</div>
                </div>
                <Badge variant="outline" className={cn('text-[10px]', l.estado === 'respondido' && 'border-emerald-300 text-emerald-700')}>
                  {l.estado}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 px-2" title="Copiar solo el link"
                  onClick={() => copiar(l.link, `Link de ${l.contacto} copiado`)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2" title="Copiar mensaje completo para WhatsApp"
                  onClick={() => copiar(mensajeWhatsApp(l), `Mensaje para ${l.contacto} copiado`)}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NpsPanel;
