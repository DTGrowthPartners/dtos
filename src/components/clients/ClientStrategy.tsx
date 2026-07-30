import { useEffect, useState } from 'react';
import { Target, Gauge, Wallet, Plus, Trash2, Loader2, Save, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';

/**
 * Estrategia y metas del cliente: el contexto que DT-OS necesita para
 * interpretar los resultados de pauta (objetivo, KPIs y presupuesto publicitario
 * del CLIENTE — separado del MRR/honorarios de DTGP).
 *
 * Persistencia: AppConfig (clave estrategia_<clientId>), sin migraciones.
 */

export interface EstrategiaConfig {
  objetivo: { principal: string; conversion: string; producto: string; mercado: string; observaciones: string };
  metas: { metaMensual: string; kpiPrincipal: string; costoObjetivo: string; kpiSecundario: string; metaSecundaria: string };
  presupuesto: { mensual: string; vigencia: string; moneda: string; canal: string; cuentaPublicitaria: string };
  historial: { mes: string; monto: string }[];
}

const EMPTY: EstrategiaConfig = {
  objetivo: { principal: '', conversion: '', producto: '', mercado: '', observaciones: '' },
  metas: { metaMensual: '', kpiPrincipal: '', costoObjetivo: '', kpiSecundario: '', metaSecundaria: '' },
  presupuesto: { mensual: '', vigencia: '', moneda: 'COP', canal: 'Meta Ads', cuentaPublicitaria: '' },
  historial: [],
};

export const estrategiaKey = (clientId: string) => `estrategia_${clientId}`;

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ClientStrategy({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<EstrategiaConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [nuevoMes, setNuevoMes] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');

  useEffect(() => {
    apiClient
      .get<{ value: EstrategiaConfig | null }>(`/api/config/${estrategiaKey(clientId)}`)
      .then((d) => setCfg({ ...EMPTY, ...(d.value || {}), objetivo: { ...EMPTY.objetivo, ...(d.value?.objetivo || {}) }, metas: { ...EMPTY.metas, ...(d.value?.metas || {}) }, presupuesto: { ...EMPTY.presupuesto, ...(d.value?.presupuesto || {}) }, historial: d.value?.historial || [] }))
      .catch(() => setCfg(EMPTY));
  }, [clientId]);

  if (!cfg) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/config/${estrategiaKey(clientId)}`, { value: cfg });
      toast({ title: 'Estrategia guardada', description: `Objetivos y presupuesto de ${clientName} actualizados` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const set = (path: 'objetivo' | 'metas' | 'presupuesto', field: string, value: string) =>
    setCfg({ ...cfg, [path]: { ...cfg[path], [field]: value } });

  const addHistorial = () => {
    if (!nuevoMes || !nuevoMonto) return;
    setCfg({ ...cfg, historial: [...cfg.historial, { mes: nuevoMes, monto: nuevoMonto }].sort((a, b) => b.mes.localeCompare(a.mes)) });
    setNuevoMes(''); setNuevoMonto('');
  };

  const fmtMes = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    if (!y || !mm) return m;
    const label = new Date(y, mm - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className="space-y-4">
      {/* Presupuesto de pauta ≠ honorarios DTGP */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 flex items-start gap-2 text-xs">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-muted-foreground">
          El <span className="font-medium text-blue-300">presupuesto de pauta</span> es la inversión publicitaria del cliente (Meta Ads) —
          está separado del MRR y de la facturación de DTGP. Los reportes comparan resultados contra ESTE presupuesto y estas metas.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Objetivo del cliente" icon={Target}>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Objetivo principal</Label>
              <Input placeholder="Generar conversaciones calificadas" value={cfg.objetivo.principal} onChange={(e) => set('objetivo', 'principal', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Conversión principal</Label>
                <Input placeholder="Conversación por WhatsApp" value={cfg.objetivo.conversion} onChange={(e) => set('objetivo', 'conversion', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Producto prioritario</Label>
                <Input placeholder="Tratamientos estéticos" value={cfg.objetivo.producto} onChange={(e) => set('objetivo', 'producto', e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Mercado objetivo</Label>
              <Input placeholder="Cartagena" value={cfg.objetivo.mercado} onChange={(e) => set('objetivo', 'mercado', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Observaciones</Label>
              <Textarea rows={2} placeholder="Priorizar tratamientos de mayor ticket" value={cfg.objetivo.observaciones} onChange={(e) => set('objetivo', 'observaciones', e.target.value)} /></div>
          </div>
        </Section>

        <Section title="Metas y KPI" icon={Gauge}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Meta mensual</Label>
                <Input placeholder="2.500 conversaciones" value={cfg.metas.metaMensual} onChange={(e) => set('metas', 'metaMensual', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">KPI principal</Label>
                <Input placeholder="Costo por conversación" value={cfg.metas.kpiPrincipal} onChange={(e) => set('metas', 'kpiPrincipal', e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Costo objetivo</Label>
              <Input placeholder="Máximo $9.000" value={cfg.metas.costoObjetivo} onChange={(e) => set('metas', 'costoObjetivo', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">KPI secundario</Label>
                <Input placeholder="Tasa clic → conversación" value={cfg.metas.kpiSecundario} onChange={(e) => set('metas', 'kpiSecundario', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Meta secundaria</Label>
                <Input placeholder="Mínimo 5%" value={cfg.metas.metaSecundaria} onChange={(e) => set('metas', 'metaSecundaria', e.target.value)} /></div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Presupuesto de pauta" icon={Wallet}>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1"><Label className="text-xs">Presupuesto mensual</Label>
            <Input type="number" placeholder="40000000" value={cfg.presupuesto.mensual} onChange={(e) => set('presupuesto', 'mensual', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Vigencia</Label>
            <Input placeholder="1 al 31 de julio" value={cfg.presupuesto.vigencia} onChange={(e) => set('presupuesto', 'vigencia', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Moneda</Label>
            <Select value={cfg.presupuesto.moneda} onValueChange={(v) => set('presupuesto', 'moneda', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
            </Select></div>
          <div className="space-y-1"><Label className="text-xs">Canal</Label>
            <Input placeholder="Meta Ads" value={cfg.presupuesto.canal} onChange={(e) => set('presupuesto', 'canal', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Cuenta publicitaria</Label>
            <Input placeholder={clientName} value={cfg.presupuesto.cuentaPublicitaria} onChange={(e) => set('presupuesto', 'cuentaPublicitaria', e.target.value)} /></div>
        </div>

        {/* Historial de presupuestos */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Historial de presupuestos</p>
          {cfg.historial.length > 0 && (
            <div className="space-y-1 mb-3">
              {cfg.historial.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-0">
                  <span>{fmtMes(h.mes)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">${Number(h.monto).toLocaleString('es-CO')}</span>
                    <button onClick={() => setCfg({ ...cfg, historial: cfg.historial.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">Mes</Label>
              <Input type="month" className="w-[160px]" value={nuevoMes} onChange={(e) => setNuevoMes(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Monto</Label>
              <Input type="number" className="w-[160px]" placeholder="40000000" value={nuevoMonto} onChange={(e) => setNuevoMonto(e.target.value)} /></div>
            <Button variant="outline" size="sm" onClick={addHistorial} disabled={!nuevoMes || !nuevoMonto}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar estrategia'}
        </Button>
      </div>
    </div>
  );
}
