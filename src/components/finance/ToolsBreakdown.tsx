import { useMemo } from 'react';
import { Wrench } from 'lucide-react';

interface Tx { descripcion?: string; categoria?: string; importe: number }

// Reglas de clasificación por herramienta (se detecta en la descripción o categoría).
const RULES: { name: string; color: string; re: RegExp }[] = [
  { name: 'Claude', color: '#D97757', re: /claude|anthropic/i },
  { name: 'ChatGPT / OpenAI', color: '#10a37f', re: /openai|chatgpt|\bgpt\b/i },
  { name: 'OpenRouter', color: '#8b5cf6', re: /openrouter/i },
  { name: 'WhatsApp API', color: '#25d366', re: /whapi|whatsapp|twilio|funnelly/i },
  { name: 'Hosting / Dominios', color: '#0ea5e9', re: /namecheap|name-cheap|vercel|render|hosting|dominio|digitalocean|hetzner|cloudflare|godaddy/i },
  { name: 'Lovable', color: '#f472b6', re: /lovable/i },
  { name: 'Cursor', color: '#a3a3a3', re: /cursor/i },
  { name: 'Notion', color: '#e5e7eb', re: /notion/i },
  { name: 'Canva', color: '#06b6d4', re: /canva/i },
];

const isToolCategory = (c?: string) => /herramient|software|servidor|hosting|dominio|saas|suscrip/i.test(c || '');
const COP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

export default function ToolsBreakdown({ gastos }: { gastos: Tx[] }) {
  const { rows, total } = useMemo(() => {
    const by: Record<string, number> = {};
    let otras = 0;
    for (const t of gastos) {
      const text = `${t.descripcion || ''} ${t.categoria || ''}`;
      const rule = RULES.find((r) => r.re.test(text));
      if (rule) by[rule.name] = (by[rule.name] || 0) + (t.importe || 0);
      else if (isToolCategory(t.categoria)) otras += t.importe || 0;
    }
    const list = RULES.filter((r) => by[r.name] > 0).map((r) => ({ name: r.name, color: r.color, value: by[r.name] }));
    if (otras > 0) list.push({ name: 'Otras herramientas', color: '#6b7280', value: otras });
    list.sort((a, b) => b.value - a.value);
    return { rows: list, total: list.reduce((a, r) => a + r.value, 0) };
  }, [gastos]);

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Herramientas / IA
        </h3>
        <span className="text-sm font-bold tabular-nums">{COP(total)}</span>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Desglose por servicio (detectado de la descripción)</p>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = Math.round((r.value / total) * 100);
          return (
            <div key={r.name}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="text-muted-foreground truncate">{r.name}</span>
                </span>
                <span className="font-medium tabular-nums ml-2 whitespace-nowrap">{COP(r.value)} <span className="text-muted-foreground text-xs">· {pct}%</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
