import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BookOpen, Plus, Search, FileText, Pencil, Trash2, ChevronLeft, Save, X, Loader2, FolderOpen, ImagePlus,
} from 'lucide-react';

// ==================== Tipos ====================

interface DocSummary {
  id: string;
  titulo: string;
  tipo: string;
  updatedAt: string;
}

interface DocProject {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  docs: DocSummary[];
}

interface DocEntry extends DocSummary {
  projectId: string;
  contenido: string;
}

const TIPOS: Record<string, { label: string; color: string }> = {
  'ficha-tecnica': { label: 'Ficha técnica', color: 'bg-blue-100 text-blue-800' },
  guia: { label: 'Guía', color: 'bg-emerald-100 text-emerald-800' },
  api: { label: 'API', color: 'bg-violet-100 text-violet-800' },
  proceso: { label: 'Proceso', color: 'bg-amber-100 text-amber-800' },
  doc: { label: 'Documento', color: 'bg-slate-100 text-slate-700' },
};
const tipoInfo = (t: string) => TIPOS[t] || TIPOS.doc;

const COLORES = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#475569'];

// ==================== Mini-renderizador de markdown ====================
// Suficiente para fichas técnicas: títulos, negrita, cursiva, código, listas,
// enlaces, citas y separadores. Sin dependencias externas.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inlineMd = (s: string) =>
  s
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    // imágenes primero (su sintaxis contiene la de los enlaces)
    .replace(/!\[([^\]]*)\]\(((?:https?:\/\/|\/api\/docs\/files\/)[^\s)]+)\)/g,
      '<img src="$2" alt="$1" loading="lazy" class="my-2 max-w-full rounded-md border border-border" />')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-primary underline underline-offset-2">$1</a>');

function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let listMode: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listMode) { out.push(listMode === 'ul' ? '</ul>' : '</ol>'); listMode = null; } };

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      closeList();
      out.push(inCode ? '</code></pre>' : '<pre class="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono"><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(escapeHtml(raw) + '\n'); continue; }

    const line = escapeHtml(raw);
    const t = line.trim();
    if (!t) { closeList(); continue; }

    const h = t.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      const cls = ['text-xl font-bold mt-4 mb-2', 'text-lg font-bold mt-4 mb-1.5', 'text-base font-semibold mt-3 mb-1', 'text-sm font-semibold mt-2 mb-1'][lvl - 1];
      out.push(`<h${lvl} class="${cls}">${inlineMd(h[2])}</h${lvl}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) { closeList(); out.push('<hr class="my-3 border-border" />'); continue; }
    if (t.startsWith('&gt;')) {
      closeList();
      out.push(`<blockquote class="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">${inlineMd(t.slice(4).trim())}</blockquote>`);
      continue;
    }
    const ul = t.match(/^[-*]\s+(.*)/);
    if (ul) {
      if (listMode !== 'ul') { closeList(); out.push('<ul class="my-1.5 list-disc space-y-0.5 pl-5">'); listMode = 'ul'; }
      out.push(`<li>${inlineMd(ul[1])}</li>`);
      continue;
    }
    const ol = t.match(/^\d+[.)]\s+(.*)/);
    if (ol) {
      if (listMode !== 'ol') { closeList(); out.push('<ol class="my-1.5 list-decimal space-y-0.5 pl-5">'); listMode = 'ol'; }
      out.push(`<li>${inlineMd(ol[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p class="my-1.5 leading-relaxed">${inlineMd(t)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}

// ==================== Página ====================

const Documentaciones = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<DocProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocEntry | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Edición
  const [editing, setEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState('');
  const [editTipo, setEditTipo] = useState('doc');
  const [editContenido, setEditContenido] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Sube una imagen y la inserta como markdown al final del contenido
  const subirImagen = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Solo imágenes', description: 'png, jpg, gif o webp', variant: 'destructive' });
      return;
    }
    setUploadingImg(true);
    try {
      const token = await (await import('@/lib/auth')).authService.getToken();
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`${API_URL}/api/docs/upload`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})) as any).message || 'No se pudo subir');
      const { url } = await r.json();
      const nombre = file.name.replace(/\.[^.]+$/, '') || 'imagen';
      setEditContenido((prev) => `${prev.trimEnd()}\n\n![${nombre}](${url})\n`);
      toast({ title: 'Imagen insertada' });
    } catch (e) {
      toast({ title: 'Error subiendo imagen', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setUploadingImg(false);
    }
  };

  // Diálogos de creación
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [npNombre, setNpNombre] = useState('');
  const [npDescripcion, setNpDescripcion] = useState('');
  const [npColor, setNpColor] = useState(COLORES[0]);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [ndTitulo, setNdTitulo] = useState('');
  const [ndTipo, setNdTipo] = useState('doc');

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const fetchProjects = async () => {
    try {
      const data = await apiClient.get<DocProject[]>('/api/docs/projects');
      setProjects(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las documentaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchProjects(); }, []);

  const openDoc = async (docId: string) => {
    setDocLoading(true);
    setEditing(false);
    try {
      const doc = await apiClient.get<DocEntry>(`/api/docs/entries/${docId}`);
      setSelectedDoc(doc);
    } catch {
      toast({ title: 'Error', description: 'No se pudo abrir el documento', variant: 'destructive' });
    } finally {
      setDocLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    setEditTitulo(selectedDoc.titulo);
    setEditTipo(selectedDoc.tipo);
    setEditContenido(selectedDoc.contenido);
    setEditing(true);
  };

  const saveDoc = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const updated = await apiClient.put<DocEntry>(`/api/docs/entries/${selectedDoc.id}`, {
        titulo: editTitulo,
        tipo: editTipo,
        contenido: editContenido,
      });
      setSelectedDoc(updated);
      setEditing(false);
      fetchProjects();
      toast({ title: 'Documento guardado' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = async (doc: DocSummary) => {
    if (!confirm(`¿Eliminar el documento "${doc.titulo}"?`)) return;
    try {
      await apiClient.delete(`/api/docs/entries/${doc.id}`);
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      fetchProjects();
      toast({ title: 'Documento eliminado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  const createProject = async () => {
    try {
      const p = await apiClient.post<DocProject>('/api/docs/projects', {
        nombre: npNombre, descripcion: npDescripcion, color: npColor,
      });
      setNewProjectOpen(false);
      setNpNombre(''); setNpDescripcion(''); setNpColor(COLORES[0]);
      await fetchProjects();
      setSelectedProjectId(p.id);
      toast({ title: 'Proyecto creado' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear', variant: 'destructive' });
    }
  };

  const deleteProject = async (p: DocProject) => {
    if (!confirm(`¿Eliminar "${p.nombre}" con sus ${p.docs.length} documento(s)? Esta acción no se puede deshacer.`)) return;
    try {
      await apiClient.delete(`/api/docs/projects/${p.id}`);
      if (selectedProjectId === p.id) { setSelectedProjectId(null); setSelectedDoc(null); }
      fetchProjects();
      toast({ title: 'Proyecto eliminado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  const createDoc = async () => {
    if (!selectedProject) return;
    try {
      const doc = await apiClient.post<DocEntry>(`/api/docs/projects/${selectedProject.id}/entries`, {
        titulo: ndTitulo, tipo: ndTipo, contenido: '',
      });
      setNewDocOpen(false);
      setNdTitulo(''); setNdTipo('doc');
      await fetchProjects();
      setSelectedDoc(doc);
      setEditTitulo(doc.titulo); setEditTipo(doc.tipo); setEditContenido('');
      setEditing(true); // un doc nuevo se abre directo en modo edición
      toast({ title: 'Documento creado' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo crear', variant: 'destructive' });
    }
  };

  // Búsqueda global: filtra documentos por título/tipo en todos los proyectos
  const busqueda = search.trim().toLowerCase();
  const resultados = useMemo(() => {
    if (!busqueda) return [];
    return projects.flatMap((p) =>
      p.docs
        .filter((d) => `${d.titulo} ${tipoInfo(d.tipo).label} ${p.nombre}`.toLowerCase().includes(busqueda))
        .map((d) => ({ ...d, projectNombre: p.nombre, projectId: p.id, projectColor: p.color }))
    );
  }, [busqueda, projects]);

  const fmtFecha = (s: string) =>
    new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="container mx-auto space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-shrink-0">
          <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
            <BookOpen className="h-6 w-6 text-primary" />
            Documentaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Fichas técnicas, guías y documentación de cada proyecto
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px] pl-9"
            />
          </div>
          <Button onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Nuevo proyecto</span>
          </Button>
        </div>
      </div>

      {/* Resultados de búsqueda global */}
      {busqueda && (
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {resultados.length} resultado(s) para “{search}”
            </div>
            <div className="space-y-1">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedProjectId(r.projectId); openDoc(r.id); setSearch(''); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.projectColor }} />
                  <span className="font-medium">{r.titulo}</span>
                  <Badge className={cn('text-[10px]', tipoInfo(r.tipo).color)}>{tipoInfo(r.tipo).label}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{r.projectNombre}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
        </div>
      ) : !selectedProject ? (
        /* ==================== Grid de proyectos ==================== */
        projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 opacity-40" />
              <div>
                <p className="font-medium text-foreground">Aún no hay proyectos documentados</p>
                <p className="text-sm">Crea el primero: DTOS, bots de WhatsApp, Meta reportes, MCP…</p>
              </div>
              <Button onClick={() => setNewProjectOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo proyecto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => { setSelectedProjectId(p.id); setSelectedDoc(null); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ background: p.color }}
                      >
                        <BookOpen className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{p.nombre}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.descripcion || 'Sin descripción'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteProject(p); }}
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.docs.length} documento(s)</span>
                    {p.docs.length > 0 && (
                      <span>últ. act. {fmtFecha(p.docs.reduce((a, d) => (d.updatedAt > a ? d.updatedAt : a), p.docs[0].updatedAt))}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ==================== Proyecto: lista + visor ==================== */
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Lista de documentos */}
          <Card className="md:w-[300px] md:flex-shrink-0">
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  className="flex items-center gap-1 text-sm font-semibold hover:text-primary"
                  onClick={() => { setSelectedProjectId(null); setSelectedDoc(null); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: selectedProject.color }} />
                  {selectedProject.nombre}
                </button>
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setNewDocOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {selectedProject.descripcion && (
                <p className="mb-2 text-xs text-muted-foreground">{selectedProject.descripcion}</p>
              )}
              <div className="space-y-1">
                {selectedProject.docs.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Sin documentos aún. Crea el primero con +
                  </p>
                )}
                {selectedProject.docs.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                      selectedDoc?.id === d.id && 'bg-muted font-medium'
                    )}
                    onClick={() => openDoc(d.id)}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{d.titulo}</span>
                    <Badge className={cn('flex-shrink-0 text-[9px]', tipoInfo(d.tipo).color)}>
                      {tipoInfo(d.tipo).label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteDoc(d); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Visor / editor */}
          <Card className="min-w-0 flex-1">
            <CardContent className="p-4 md:p-5">
              {docLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abriendo…
                </div>
              ) : !selectedDoc ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Selecciona un documento de la lista o crea uno nuevo</p>
                </div>
              ) : editing ? (
                /* ---------- Edición ---------- */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={editTitulo}
                      onChange={(e) => setEditTitulo(e.target.value)}
                      className="h-9 flex-1 min-w-[200px] font-semibold"
                      placeholder="Título del documento"
                    />
                    <Select value={editTipo} onValueChange={setEditTipo}>
                      <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPOS).map(([v, t]) => (
                          <SelectItem key={v} value={v}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={saveDoc} disabled={saving || !editTitulo.trim()}>
                      {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                      Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      <X className="mr-1.5 h-4 w-4" /> Cancelar
                    </Button>
                    <label className="inline-flex cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) subirImagen(f);
                          e.target.value = '';
                        }}
                      />
                      <span className={cn(
                        'inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent',
                        uploadingImg && 'pointer-events-none opacity-60'
                      )}>
                        {uploadingImg ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
                        Imagen
                      </span>
                    </label>
                  </div>
                  <Textarea
                    value={editContenido}
                    onChange={(e) => setEditContenido(e.target.value)}
                    onPaste={(e) => {
                      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
                      if (item) {
                        e.preventDefault();
                        const f = item.getAsFile();
                        if (f) subirImagen(f);
                      }
                    }}
                    placeholder={'Escribe en markdown…\n\n# Título\n## Subtítulo\n- lista\n**negrita**, `código`, [enlace](https://...)\n```\nbloque de código\n```\n\nPega una imagen (Ctrl+V) o usa el botón Imagen.'}
                    className="min-h-[420px] font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Soporta markdown: # títulos, **negrita**, *cursiva*, `código`, ```bloques```, listas, [enlaces](url),
                    imágenes (botón o pegar con Ctrl+V), &gt; citas y --- separadores.
                  </p>
                </div>
              ) : (
                /* ---------- Lectura ---------- */
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
                    <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{selectedDoc.titulo}</h2>
                    <Badge className={cn('text-[10px]', tipoInfo(selectedDoc.tipo).color)}>
                      {tipoInfo(selectedDoc.tipo).label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">act. {fmtFecha(selectedDoc.updatedAt)}</span>
                    <Button size="sm" variant="outline" onClick={startEdit}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                  </div>
                  {selectedDoc.contenido.trim() ? (
                    <div
                      className="max-w-none text-sm text-foreground"
                      dangerouslySetInnerHTML={{ __html: mdToHtml(selectedDoc.contenido) }}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Documento vacío — dale a Editar para escribir el contenido.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog: nuevo proyecto */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>Un proyecto agrupa toda la documentación de un sistema o producto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={npNombre} onChange={(e) => setNpNombre(e.target.value)} placeholder="p. ej. DTOS, Bot Dairo, Meta reportes…" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input value={npDescripcion} onChange={(e) => setNpDescripcion(e.target.value)} placeholder="Qué es este proyecto" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="mt-1 flex gap-2">
                {COLORES.map((c) => (
                  <button
                    key={c}
                    className={cn('h-7 w-7 rounded-full border-2', npColor === c ? 'border-foreground' : 'border-transparent')}
                    style={{ background: c }}
                    onClick={() => setNpColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancelar</Button>
              <Button onClick={createProject} disabled={!npNombre.trim()}>Crear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: nuevo documento */}
      <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo documento</DialogTitle>
            <DialogDescription>En {selectedProject?.nombre}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={ndTitulo} onChange={(e) => setNdTitulo(e.target.value)} placeholder="p. ej. Ficha técnica, Guía de despliegue…" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={ndTipo} onValueChange={setNdTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([v, t]) => (
                    <SelectItem key={v} value={v}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewDocOpen(false)}>Cancelar</Button>
              <Button onClick={createDoc} disabled={!ndTitulo.trim()}>Crear y escribir</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documentaciones;
