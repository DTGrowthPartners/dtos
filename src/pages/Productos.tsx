import { Layers, CreditCard, MessageSquare, Users, TrendingUp, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { products } from '@/data/mockData';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  CreditCard,
  MessageSquare,
};

const statusConfig = {
  development: { label: 'En Desarrollo', className: 'bg-warning/10 text-warning border-warning/20' },
  beta: { label: 'Beta', className: 'bg-primary/10 text-primary border-primary/20' },
  live: { label: 'En Producción', className: 'bg-success/10 text-success border-success/20' },
};

const roadmapItems = [
  { id: '1', title: 'Sistema de autenticación', product: 'DT-OS', status: 'completed', date: 'Dic 2024' },
  { id: '2', title: 'Dashboard principal', product: 'DT-OS', status: 'in_progress', date: 'Dic 2024' },
  { id: '3', title: 'Módulo CRM', product: 'DT-OS', status: 'planned', date: 'Ene 2025' },
  { id: '4', title: 'Integración Stripe', product: 'CobraFlow', status: 'completed', date: 'Nov 2024' },
  { id: '5', title: 'Panel de facturación', product: 'CobraFlow', status: 'in_progress', date: 'Dic 2024' },
  { id: '6', title: 'API WhatsApp Business', product: 'ChatSuite', status: 'in_progress', date: 'Dic 2024' },
];

const roadmapStatusConfig = {
  completed: { label: 'Completado', className: 'bg-success/10 text-success' },
  in_progress: { label: 'En Progreso', className: 'bg-primary/10 text-primary' },
  planned: { label: 'Planificado', className: 'bg-muted text-muted-foreground' },
};

export default function Productos() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productos DT Cloud Hub</h1>
          <p className="text-muted-foreground">Estado de desarrollo y métricas de uso</p>
        </div>
        <Button variant="outline" className="w-full md:w-auto">
          <Code className="h-4 w-4 mr-2" />
          Ver Documentación
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {products.map((product) => {
          const Icon = iconMap[product.icon] || Layers;
          const status = statusConfig[product.status];

          return (
            <div key={product.id} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="outline" className={cn('text-xs', status.className)}>
                  {status.label}
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{product.description}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium text-foreground">{product.progress}%</span>
                </div>
                <Progress value={product.progress} className="h-2" />
              </div>

              {product.users !== undefined && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{product.users} usuarios activos</span>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full mt-4">
                Ver Detalles
              </Button>
            </div>
          );
        })}
      </div>

      {/* Roadmap */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Roadmap de Desarrollo</h3>
            <p className="text-sm text-muted-foreground">Próximas funcionalidades y mejoras</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {Object.entries(roadmapStatusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', config.className.split(' ')[0])} />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {roadmapItems.map((item) => {
            const itemStatus = roadmapStatusConfig[item.status as keyof typeof roadmapStatusConfig];
            return (
              <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', itemStatus.className.split(' ')[0])} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.product}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {item.date}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Usuarios Totales</p>
              <p className="text-xl font-bold text-foreground">12</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Code className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">APIs Activas</p>
              <p className="text-xl font-bold text-foreground">3</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Layers className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Productos en Desarrollo</p>
              <p className="text-xl font-bold text-foreground">2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
