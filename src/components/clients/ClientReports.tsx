import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, Settings2, Users, Loader2, Save, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { estrategiaKey, type EstrategiaConfig } from './ClientStrategy';

/**
 * Configuración del reporte automático de Meta Ads del cliente: frecuencia,
 * comparaciones, flujo de aprobación y destinatarios (tomados de Contactos,
 * sin duplicar datos). Persistencia en AppConfig (reportes_<clientId>).
 *
 * La GENERACIÓN automática del reporte se conecta en la siguiente fase; esta
 * pestaña deja lista toda la configuración que ese motor va a leer.
 */

interface DestinatarioPrefs { semanal: boolean; mensual: boolean; correo: boolean; whatsapp: boolean; alertas: boolean }
interface ReportesConfig {
  activo: boolean;
  tipo: string;
  frecuencia: 'semanal' | 'quincenal' | 'mensual';
  periodo: string;
  dia: string;
  hora: string;
  plantilla: string;
  compararSemanaAnterior: boolean;
  compararMeta: boolean;
  compararPresupuesto: boolean;
  modoEnvio: 'auto' | 'aprobacion';
  responsable: string;
  destinatarios: Record<string, DestinatarioPrefs>;
  ultimoEnvio?: string;
}
interface Contacto { id: string; nombre: string; cargo?: string | null; email?: string | null; telefono?: string | null }

const EMPTY: ReportesConfig = {
  activo: false,
  tipo: 'Meta Ads semanal',
  frecuencia: 'semanal',
  periodo: 'Lunes a domingo',
  dia: 'Lunes',
  hora: '08:00',
  plantilla: 'Reporte Meta Ads v2',
  compararSemanaAnterior: true,
  compararMeta: true,
  compararPresupuesto: true,
  modoEnvio: 'aprobacion',
  responsable: 'Dairo Traslaviña',
  destinatarios: {},
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIA_IDX: Record<string, number> = { Domingo: 0, Lunes: 1, Martes: 2, 'Miércoles': 3, Jueves: 4, Viernes: 5, 'Sábado': 6 };
const PREF_DEFAULT: DestinatarioPrefs = { semanal: true, mensual: true, correo: true, whatsapp: false, alertas: false };

/** Próxima fecha en que cae `dia` a las `hora` (para "Próxima generación"). */
const proximaGeneracion = (dia: string, hora: string): string => {
  const target = DIA_IDX[dia] ?? 1;
  const [h, m] = (hora || '08:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 8, m || 0, 0, 0);
  let add = (target - d.getDay() + 7) % 7;
  if (add === 0 && d.getTime() <= Date.now()) add = 7;
  d.setDate(d.getDate() + add);
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) + ` · ${hora}`;
};

export default function ClientReports({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ReportesConfig | null>(null);
  const [estrategia, setEstrategia] = useState<EstrategiaConfig | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<{ value: ReportesConfig | null }>(`/api/config/reportes_${clientId}`)
      .then((d) => setCfg({ ...EMPTY, ...(d.value || {}), destinatarios: d.value?.destinatarios || {} }))
      .catch(() => setCfg(EMPTY));
    apiClient.get<{ value: EstrategiaConfig | null }>(`/api/config/${estrategiaKey(clientId)}`)
      .then((d) => setEstrategia(d.value)).catch(() => {});
    apiClient.get<Contacto[]>(`/api/terceros?clientId=${clientId}`).then(setContactos).catch(() => {});
  }, [clientId]);

  const activos = useMemo(
    () => Object.values(cfg?.destinatarios || {}).filter((p) => p.semanal || p.mensual).length,
    [cfg]
  );

  if (!cfg) {
    return <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/config/reportes_${clientId}`, { value: cfg });
      toast({ title: 'Configuración guardada', description: `Reporte de ${clientName} ${cfg.activo ? 'activo' : 'pausado'}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const prefsDe = (id: string): DestinatarioPrefs => cfg.destinatarios[id] || { ...PREF_DEFAULT, semanal: false, mensual: false, correo: false };
  const togglePref = (id: string, campo: keyof DestinatarioPrefs) => {
    const cur = cfg.destinatarios[id] || { semanal: false, mensual: false, correo: false, whatsapp: false, alertas: false };
    setCfg({ ...cfg, destinatarios: { ...cfg.destinatarios, [id]: { ...cur, [campo]: !cur[campo] } } });
  };

  const presupuestoVigente = estrategia?.presupuesto?.mensual
    ? `$${Number(estrategia.presupuesto.mensual).toLocaleString('es-CO')}${estrategia.presupuesto.vigencia ? ` · ${estrategia.presupuesto.vigencia}` : ''}`
    : 'Sin definir (pestaña Estrategia)';

  return (
    <div className="space-y-4">
      {/* Tarjeta resumen del módulo */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-muted-foreground" /> REPORTE {cfg.frecuencia.toUpperCase()} DE META ADS
          </h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.activo ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-border text-muted-foreground'}`}>
            {cfg.activo ? 'ACTIVO' : 'PAUSADO'}
          </span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div><p className="text-[11px] text-muted-foreground">Objetivo</p><p>{estrategia?.objetivo?.principal || 'Sin definir (pestaña Estrategia)'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">KPI objetivo</p><p>{estrategia?.metas?.kpiPrincipal ? `${estrategia.metas.kpiPrincipal}${estrategia.metas.costoObjetivo ? ` · ${estrategia.metas.costoObjetivo}` : ''}` : 'Sin definir'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Presupuesto vigente</p><p>{presupuestoVigente}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Destinatarios</p><p>{activos} contacto{activos === 1 ? '' : 's'} seleccionado{activos === 1 ? '' : 's'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Próxima generación</p><p className="capitalize">{cfg.activo ? proximaGeneracion(cfg.dia, cfg.hora) : '—'}</p></div>
          <div><p className="text-[11px] text-muted-foreground">Último reporte</p><p>{cfg.ultimoEnvio || 'Aún no se ha enviado'}</p></div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Próximamente', description: 'La generación automática del borrador se conecta en la siguiente fase — la configuración ya queda lista.' })}>
            <Sparkles className="h-4 w-4 mr-1.5" /> Generar borrador
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Configuración general */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted-foreground" /> Configuración general</h3>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              Reporte activo <Switch checked={cfg.activo} onCheckedChange={(v) => setCfg({ ...cfg, activo: v })} />
            </label>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Frecuencia</Label>
                <Select value={cfg.frecuencia} onValueChange={(v) => setCfg({ ...cfg, frecuencia: v as ReportesConfig['frecuencia'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Periodo analizado</Label>
                <Input value={cfg.periodo} onChange={(e) => setCfg({ ...cfg, periodo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Día de generación</Label>
                <Select value={cfg.dia} onValueChange={(v) => setCfg({ ...cfg, dia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label className="text-xs">Hora</Label>
                <Input type="time" value={cfg.hora} onChange={(e) => setCfg({ ...cfg, hora: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Plantilla</Label>
              <Input value={cfg.plantilla} onChange={(e) => setCfg({ ...cfg, plantilla: e.target.value })} /></div>
            <div className="space-y-2 pt-1">
              {([
                ['compararSemanaAnterior', 'Comparar contra semana anterior'],
                ['compararMeta', 'Comparar contra meta mensual'],
                ['compararPresupuesto', 'Comparar contra presupuesto de pauta'],
              ] as const).map(([campo, label]) => (
                <label key={campo} className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-muted-foreground">{label}</span>
                  <Switch checked={cfg[campo]} onCheckedChange={(v) => setCfg({ ...cfg, [campo]: v })} />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Flujo de aprobación */}
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-4"><Users className="h-4 w-4 text-muted-foreground" /> Flujo de aprobación</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Modo de envío</Label>
              {([
                ['aprobacion', 'Requiere aprobación interna', 'DT-OS crea el borrador, el responsable revisa y aprueba antes de enviar'],
                ['auto', 'Enviar automáticamente', 'El reporte sale sin revisión manual (no recomendado aún)'],
              ] as const).map(([value, label, desc]) => (
                <label key={value} className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${cfg.modoEnvio === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                  <input type="radio" name="modoEnvio" checked={cfg.modoEnvio === value} onChange={() => setCfg({ ...cfg, modoEnvio: value })} className="mt-0.5 accent-primary" />
                  <span>
                    <span className="text-sm font-medium block">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-1"><Label className="text-xs">Responsable DTGP</Label>
              <Input value={cfg.responsable} onChange={(e) => setCfg({ ...cfg, responsable: e.target.value })} /></div>
            {cfg.activo && (
              <p className="text-xs text-muted-foreground">
                Próxima generación: <span className="capitalize font-medium text-foreground">{proximaGeneracion(cfg.dia, cfg.hora)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Destinatarios: se seleccionan de Contactos, sin duplicar datos */}
      <div className="rounded-xl bg-card border border-border p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-muted-foreground" /> Destinatarios del reporte</h3>
        <p className="text-xs text-muted-foreground mb-3">Se toman de la pestaña Contactos — agrega ahí a las personas y márcalas aquí.</p>
        {contactos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Este cliente aún no tiene contactos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-2 py-2">Contacto</th>
                  <th className="text-center font-medium px-2 py-2">Semanal</th>
                  <th className="text-center font-medium px-2 py-2">Mensual</th>
                  <th className="text-center font-medium px-2 py-2">Correo</th>
                  <th className="text-center font-medium px-2 py-2">WhatsApp</th>
                  <th className="text-center font-medium px-2 py-2">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {contactos.map((ct) => {
                  const p = prefsDe(ct.id);
                  const celdas: (keyof DestinatarioPrefs)[] = ['semanal', 'mensual', 'correo', 'whatsapp', 'alertas'];
                  return (
                    <tr key={ct.id} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-2">
                        <p className="font-medium">{ct.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[ct.cargo, ct.email, ct.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                        </p>
                      </td>
                      {celdas.map((campo) => (
                        <td key={campo} className="px-2 py-2 text-center">
                          <input type="checkbox" checked={p[campo]} onChange={() => togglePref(ct.id, campo)} className="h-4 w-4 accent-primary cursor-pointer" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}
