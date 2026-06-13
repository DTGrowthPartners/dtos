import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  bullets?: string[];
  /** Clases tailwind completas para el icono, ej "text-emerald-500 bg-emerald-500/10" */
  iconClasses?: string;
}

/**
 * Vista placeholder para features planeadas pero aun no construidas.
 * Mantiene el enlace del sidebar funcional y comunica qué hará la vista.
 */
export default function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
  bullets = [],
  iconClasses = 'text-primary bg-primary/10',
}: ComingSoonProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClasses}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {title}
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
              Próximamente
            </span>
          </h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
          <Construction className="h-4 w-4 text-amber-500" />
          En construcción — esto es lo que mostrará:
        </div>
        {bullets.length > 0 ? (
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Funcionalidad en desarrollo.</p>
        )}
      </div>
    </div>
  );
}
