import { useEffect, useMemo, useState } from 'react';
import {
  FileText, Sparkles, Loader2, Plus, Download, Eye, Trash2, RefreshCw, Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { buildProposalHTML, type ProposalData } from '@/lib/proposalTemplate';
import {
  loadProposals, createProposal, updateProposal, deleteProposal, generateProposal,
  type Proposal, type ProposalStatus,
} from '@/lib/firestoreProposalService';

const STATUS_META: Record<ProposalStatus, { label: string; classes: string }> = {
  borrador: { label: 'Borrador', classes: 'border-slate-500/40 bg-slate-500/10 text-slate-400' },
  enviada: { label: 'Enviada', classes: 'border-blue-500/40 bg-blue-500/10 text-blue-500' },
  ganada: { label: 'Ganada', classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' },
  perdida: { label: 'Perdida', classes: 'border-red-500/40 bg-red-500/10 text-red-500' },
};

const openPdf = (data: ProposalData) => {
  const html = buildProposalHTML(data);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
};

export default function Propuestas() {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Diálogo nueva propuesta
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [cliente, setCliente] = useState('');
  const [notas, setNotas] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<ProposalData | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview de una propuesta existente
  const [preview, setPreview] = useState<ProposalData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProposals(await loadProposals());
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las propuestas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const resetDialog = () => {
    setTranscript(''); setCliente(''); setNotas(''); setDraft(null);
  };

  const handleGenerate = async () => {
    if (transcript.trim().length < 30) {
      toast({ title: 'Transcripción muy corta', description: 'Pega la transcripción de la reunión.' });
      return;
    }
    setGenerating(true);
    try {
      const data = await generateProposal({ transcript: transcript.trim(), cliente: cliente.trim() || undefined, notas: notas.trim() || undefined });
      setDraft(data);
      toast({ title: '✨ Propuesta generada', description: 'Revísala y guárdala o descárgala.' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo generar', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await createProposal({
        cliente: draft.cliente || cliente || 'Sin nombre',
        titulo: draft.titulo || 'Propuesta',
        status: 'borrador',
        data: draft,
        transcript: transcript.trim() || undefined,
      });
      toast({ title: '✓ Propuesta guardada' });
      setOpen(false);
      resetDialog();
      load();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (p: Proposal, status: ProposalStatus) => {
    setProposals((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)));
    try { await updateProposal(p.id, { status }); } catch { load(); }
  };

  const handleDelete = async (p: Proposal) => {
    if (!confirm(`¿Eliminar la propuesta de ${p.cliente}?`)) return;
    setProposals((prev) => prev.filter((x) => x.id !== p.id));
    try { await deleteProposal(p.id); } catch { load(); }
  };

  const previewHtml = useMemo(() => (preview ? buildProposalHTML(preview) : ''), [preview]);
  const draftHtml = useMemo(() => (draft ? buildProposalHTML(draft) : ''), [draft]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold">Propuestas</h1>
          <p className="text-sm text-muted-foreground">
            Genera propuestas comerciales a partir de la transcripción de una reunión.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Recargar">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
        <Button onClick={() => { resetDialog(); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Nueva propuesta
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando…</div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Aún no hay propuestas. Crea una desde la transcripción de una reunión.</p>
          <Button onClick={() => { resetDialog(); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nueva propuesta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {proposals.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.cliente}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.titulo}</div>
                </div>
                <Badge variant="outline" className={cn('text-[10px] flex-shrink-0', STATUS_META[p.status].classes)}>
                  {STATUS_META[p.status].label}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(p.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1.5 mt-auto">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(p.data)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                </Button>
                <Button size="sm" variant="outline" onClick={() => openPdf(p.data)} title="Descargar PDF">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Select value={p.status} onValueChange={(v) => changeStatus(p, v as ProposalStatus)}>
                  <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as ProposalStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} className="text-muted-foreground hover:text-red-500" title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diálogo: nueva propuesta */}
      <Dialog open={open} onOpenChange={(o) => { if (!generating && !saving) { setOpen(o); if (!o) resetDialog(); } }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" /> Nueva propuesta desde transcripción
            </DialogTitle>
            <DialogDescription>
              Pega la transcripción de la reunión con el prospecto. La IA la convierte en una propuesta con el formato de DTGP.
            </DialogDescription>
          </DialogHeader>

          {!draft ? (
            <div className="space-y-3 py-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Cliente / prospecto (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} disabled={generating} />
                <Input placeholder="Notas adicionales (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} disabled={generating} />
              </div>
              <Textarea
                placeholder="Pega aquí la transcripción de la reunión…"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[280px] resize-y"
                disabled={generating}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Mic className="h-3 w-3" /> Tip: graba la reunión, transcríbela (texto) y pégala aquí.
              </p>
            </div>
          ) : (
            <div className="py-2">
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <iframe title="preview" srcDoc={draftHtml} className="w-full h-[60vh] bg-white" />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!draft ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={generating || transcript.trim().length < 30} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</> : <><Sparkles className="h-4 w-4 mr-2" />Generar propuesta</>}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>← Editar transcripción</Button>
                <Button variant="outline" onClick={() => openPdf(draft)}><Download className="h-4 w-4 mr-2" />PDF</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando…</> : 'Guardar propuesta'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: ver propuesta existente */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.titulo} — {preview?.cliente}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border overflow-hidden bg-white">
            <iframe title="ver" srcDoc={previewHtml} className="w-full h-[65vh] bg-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Cerrar</Button>
            {preview && <Button onClick={() => openPdf(preview)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Download className="h-4 w-4 mr-2" />Descargar PDF</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
