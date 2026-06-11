import {
  LayoutGrid,
  ExternalLink,
  BarChart3,
  MessageSquare,
  PenSquare,
  Mail,
  Search,
} from 'lucide-react';

interface AppItem {
  title: string;
  description: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
}

const APPS: AppItem[] = [
  {
    title: 'MetaSuite',
    description: 'Dashboard de campañas y métricas de Meta Ads.',
    url: 'https://metasuite.dtgrowthpartners.com',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
  {
    title: 'Chatwoot',
    description: 'Atención al cliente omnicanal: WhatsApp, IG, FB Messenger.',
    url: 'https://chatwoot.dtgrowthpartners.com',
    icon: MessageSquare,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-600/10',
  },
  {
    title: 'Correo DTGP',
    description: 'Webmail corporativo de DT Growth Partners (Roundcube).',
    url: 'https://correo.dtgrowthpartners.com/acceso',
    icon: Mail,
    iconColor: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
  },
  {
    title: 'Draw',
    description: 'Editor de diagramas y wireframes (drawio).',
    url: 'https://draw.dtgrowthpartners.com',
    icon: PenSquare,
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    title: 'Buscar',
    description: 'NegociosXCiudad: buscador y radar de leads por ciudad.',
    url: 'https://buscar.dtgrowthpartners.com',
    icon: Search,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-600/10',
  },
];

export default function Apps() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Apps</h1>
          <p className="text-muted-foreground">
            Sistemas y herramientas externas creadas por DT Growth Partners. Se abren en una nueva pestaña.
          </p>
        </div>
      </div>

      {/* Grid de Apps */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {APPS.map((app) => {
          const Icon = app.icon;
          return (
            <a
              key={app.title}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full"
            >
              <div className="group h-full rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${app.bgColor}`}>
                    <Icon className={`h-6 w-6 ${app.iconColor}`} />
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{app.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{app.description}</p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
