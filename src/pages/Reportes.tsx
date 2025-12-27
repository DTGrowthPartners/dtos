import { useState } from 'react';
import { FileText, Download, Plus, Calendar, Building2, Send, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clients } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface Report {
  id: string;
  title: string;
  client: string;
  month: string;
  status: 'draft' | 'sent' | 'viewed';
  createdAt: string;
  sentAt?: string;
}

const reports: Report[] = [
  { id: '1', title: 'Reporte Mensual Diciembre 2024', client: 'Equilibrio Clinic', month: 'Diciembre 2024', status: 'sent', createdAt: '2024-12-20', sentAt: '2024-12-22' },
  { id: '2', title: 'Reporte Mensual Diciembre 2024', client: 'Hoteles Santa Alejandría', month: 'Diciembre 2024', status: 'viewed', createdAt: '2024-12-18', sentAt: '2024-12-19' },
  { id: '3', title: 'Reporte Mensual Diciembre 2024', client: 'TechStart', month: 'Diciembre 2024', status: 'draft', createdAt: '2024-12-24' },
  { id: '4', title: 'Reporte Mensual Noviembre 2024', client: 'Equilibrio Clinic', month: 'Noviembre 2024', status: 'viewed', createdAt: '2024-11-28', sentAt: '2024-11-30' },
  { id: '5', title: 'Reporte Mensual Noviembre 2024', client: 'FitZone Gym', month: 'Noviembre 2024', status: 'viewed', createdAt: '2024-11-27', sentAt: '2024-11-28' },
];

const statusConfig = {
  draft: { label: 'Borrador', className: 'bg-muted text-muted-foreground border-muted', icon: FileText },
  sent: { label: 'Enviado', className: 'bg-primary/10 text-primary border-primary/20', icon: Send },
  viewed: { label: 'Visto', className: 'bg-success/10 text-success border-success/20', icon: Eye },
};

const templates = [
  { id: '1', name: 'Reporte Meta Ads Completo', description: 'Incluye métricas de campañas, análisis de audiencias y recomendaciones' },
  { id: '2', name: 'Resumen Ejecutivo', description: 'Versión resumida con KPIs principales y próximos pasos' },
  { id: '3', name: 'Reporte Multicanal', description: 'Combina Meta, Google Ads y Analytics en un solo documento' },
];

export default function Reportes() {
  const [selectedTab, setSelectedTab] = useState<'reports' | 'templates'>('reports');

  const activeClients = clients.filter((c) => c.status === 'active');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-muted-foreground">Genera y gestiona reportes para tus clientes</p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Crear Reporte
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-px">
        <button
          onClick={() => setSelectedTab('reports')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors relative',
            selectedTab === 'reports' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Reportes
          {selectedTab === 'reports' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setSelectedTab('templates')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors relative',
            selectedTab === 'templates' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Plantillas
          {selectedTab === 'templates' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {selectedTab === 'reports' ? (
        <div className="space-y-6">
          {/* Quick Generate */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-4">Generar Reporte Rápido</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {activeClients.slice(0, 3).map((client) => (
                <button
                  key={client.id}
                  className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {client.company.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{client.company}</p>
                    <p className="text-sm text-muted-foreground">Diciembre 2024</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reports List */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/50">
              <h3 className="font-semibold text-foreground">Historial de Reportes</h3>
            </div>
            <div className="divide-y divide-border">
              {reports.map((report) => {
                const status = statusConfig[report.status];
                const StatusIcon = status.icon;

                return (
                  <div key={report.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{report.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{report.client}</span>
                          <span>•</span>
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(report.createdAt).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn('text-xs', status.className)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
              <Button variant="outline" size="sm" className="w-full">
                Usar Plantilla
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
