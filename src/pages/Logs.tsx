import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Search as SearchIcon,
  RefreshCw,
  Circle,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface LogSource {
  id: string;
  category: string;
  label: string;
  description?: string;
  path: string;
  exists: boolean;
  sizeBytes?: number;
  modifiedAt?: string;
}

interface TailResult {
  success: boolean;
  id: string;
  path: string;
  lines: string[];
  truncated: boolean;
}

const formatBytes = (b?: number): string => {
  if (!b && b !== 0) return '—';
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} kB`;
  return `${b} B`;
};

const formatRelative = (iso?: string): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'hace segundos';
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
  return `hace ${Math.floor(diff / 86400000)}d`;
};

export default function Logs() {
  const { toast } = useToast();
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState(200);
  const [grep, setGrep] = useState('');
  const [tailResult, setTailResult] = useState<TailResult | null>(null);
  const [loadingTail, setLoadingTail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  // Cargar fuentes al inicio
  useEffect(() => {
    const load = async () => {
      setLoadingSources(true);
      try {
        const res = await apiClient.get<{ sources: LogSource[] }>('/api/logs');
        setSources(res.sources || []);
        // Auto-seleccionar el primer log existente (default: PM2 dtos-backend-out si está)
        const first =
          res.sources.find((s) => s.id.startsWith('pm2:') && s.label.includes('dtos-backend-out')) ||
          res.sources.find((s) => s.exists);
        if (first) setSelectedId(first.id);
      } catch (e) {
        toast({
          title: 'Error',
          description: e instanceof Error ? e.message : 'No se pudieron cargar las fuentes',
          variant: 'destructive',
        });
      } finally {
        setLoadingSources(false);
      }
    };
    load();
  }, [toast]);

  // Cargar tail del log seleccionado
  const loadTail = async () => {
    if (!selectedId) return;
    setLoadingTail(true);
    try {
      const params = new URLSearchParams();
      params.set('lines', String(lines));
      if (grep.trim()) params.set('grep', grep.trim());
      const res = await apiClient.get<TailResult>(`/api/logs/${encodeURIComponent(selectedId)}/tail?${params}`);
      setTailResult(res);
      setTimeout(() => {
        if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
      }, 30);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo leer el log',
        variant: 'destructive',
      });
    } finally {
      setLoadingTail(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadTail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lines, grep]);

  // Auto-refresh cada 5s si está activo
  useEffect(() => {
    if (!autoRefresh || !selectedId) return;
    const id = setInterval(loadTail, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedId, lines, grep]);

  const filteredSources = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return sources;
    return sources.filter(
      (x) =>
        x.label.toLowerCase().includes(s) ||
        x.category.toLowerCase().includes(s) ||
        (x.description || '').toLowerCase().includes(s) ||
        x.path.toLowerCase().includes(s)
    );
  }, [sources, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LogSource[]>();
    for (const s of filteredSources) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [filteredSources]);

  const selected = sources.find((s) => s.id === selectedId);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10">
          <FileText className="h-6 w-6 text-sky-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Logs</h1>
          <p className="text-muted-foreground">
            Tail en vivo de cualquier log del VPS (PM2, crons del negocio, sistema).
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar de fuentes */}
        <aside className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar log..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loadingSources ? (
            <div className="text-sm text-muted-foreground text-center py-4">Cargando…</div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/40 sticky top-0">
                    {category}
                  </div>
                  {items.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 border-t border-border hover:bg-muted/40 transition-colors',
                        selectedId === s.id && 'bg-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Circle className={cn('h-2 w-2 flex-shrink-0', s.exists ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground text-muted-foreground')} />
                        <div className="text-xs font-medium truncate flex-1">{s.label}</div>
                      </div>
                      {s.description && (
                        <div className="text-[10px] text-muted-foreground truncate ml-4">{s.description}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground ml-4 flex justify-between mt-0.5">
                        {s.exists ? (
                          <>
                            <span>{formatBytes(s.sizeBytes)}</span>
                            <span>{formatRelative(s.modifiedAt)}</span>
                          </>
                        ) : (
                          <span className="text-amber-600">No existe</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Visor */}
        <div className="flex flex-col h-[calc(100vh-200px)] rounded-xl border border-border bg-card overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecciona un log a la izquierda.
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{selected.category}</Badge>
                  <div className="font-semibold text-sm truncate">{selected.label}</div>
                </div>
                <code className="text-[10px] text-muted-foreground font-mono truncate block mb-2">{selected.path}</code>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={lines}
                    onChange={(e) => setLines(Number(e.target.value))}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value={100}>100 líneas</option>
                    <option value={200}>200 líneas</option>
                    <option value={500}>500 líneas</option>
                    <option value={1000}>1000 líneas</option>
                    <option value={2000}>2000 líneas</option>
                  </select>
                  <div className="relative flex-1 min-w-[180px] max-w-sm">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={grep}
                      onChange={(e) => setGrep(e.target.value)}
                      placeholder="grep…"
                      className="w-full h-8 rounded-md border border-border bg-background pl-8 pr-7 text-xs"
                    />
                    {grep && (
                      <button onClick={() => setGrep('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={cn(autoRefresh && 'border-emerald-500/40 text-emerald-600')}
                  >
                    <Circle className={cn('h-2 w-2 mr-2', autoRefresh ? 'fill-emerald-500 animate-pulse' : 'fill-muted-foreground')} />
                    {autoRefresh ? 'Auto 5s' : 'Manual'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={loadTail} disabled={loadingTail}>
                    <RefreshCw className={cn('h-3.5 w-3.5', loadingTail && 'animate-spin')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
                    }}
                  >
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Al final
                  </Button>
                </div>
              </div>

              {/* Log content */}
              <pre
                ref={preRef}
                className="flex-1 overflow-auto bg-[rgb(2,6,23)] text-slate-100 text-[11px] font-mono p-4 leading-relaxed whitespace-pre-wrap break-all"
              >
                {tailResult
                  ? tailResult.lines.length === 0
                    ? grep
                      ? `(sin coincidencias para "${grep}")`
                      : '(log vacío)'
                    : tailResult.lines.join('\n')
                  : loadingTail
                    ? 'Cargando…'
                    : ''}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
