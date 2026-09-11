import { CalendarDays, ChevronDown, FolderOpen, RotateCcw, Users } from 'lucide-react';
import { FECHAS_FILTRO, FILTROS_TAREAS_INICIALES, type FiltrosTareasIA } from '@/lib/tareasIA';
import type { Project, TeamMember } from '@/types/taskTypes';

interface Props {
  filtros: FiltrosTareasIA;
  cambiar: (filtros: FiltrosTareasIA) => void;
  proyectos: Project[];
  equipo: TeamMember[];
  deshabilitado: boolean;
  hayFiltros: boolean;
}

export default function FiltrosRapidosTareasIA({ filtros, cambiar, proyectos, equipo, deshabilitado, hayFiltros }: Props) {
  return <div className="tia-filtros-rapidos" role="group" aria-label="Filtros rápidos de tareas">
    <label className="tia-filtro-rapido" data-activo={filtros.proyecto !== 'todos'}>
      <FolderOpen size={14} aria-hidden="true" />
      <select aria-label="Proyecto en el encabezado" disabled={deshabilitado} value={filtros.proyecto} onChange={(e) => cambiar({ ...filtros, proyecto: e.target.value })}>
        <option value="todos">Todos los proyectos</option>
        {filtros.carpeta === 'todas' && <option value="sin-proyecto">Sin proyecto</option>}
        {proyectos.filter((p) => filtros.carpeta === 'todas' || p.folderId === filtros.carpeta).map((p) => <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (archivado)' : ''}</option>)}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </label>
    <label className="tia-filtro-rapido" data-activo={filtros.responsable !== 'mias'}>
      <Users size={14} aria-hidden="true" />
      <select aria-label="Responsable en el encabezado" disabled={deshabilitado} value={filtros.responsable} onChange={(e) => cambiar({ ...filtros, responsable: e.target.value })}>
        <option value="mias">Mis tareas</option><option value="todos">Todas las accesibles</option>
        {equipo.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </label>
    <label className="tia-filtro-rapido" data-activo={filtros.fecha !== 'todas'}>
      <CalendarDays size={14} aria-hidden="true" />
      <select aria-label="Fecha en el encabezado" disabled={deshabilitado} value={filtros.fecha} onChange={(e) => cambiar({ ...filtros, fecha: e.target.value as FiltrosTareasIA['fecha'] })}>
        {FECHAS_FILTRO.map((f) => <option key={f.valor} value={f.valor}>{f.texto}</option>)}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </label>
    {hayFiltros && <button className="tia-restablecer-rapidos" disabled={deshabilitado} aria-label="Restablecer todos los filtros" title="Restablecer todos los filtros" onClick={() => cambiar({ ...FILTROS_TAREAS_INICIALES })}><RotateCcw size={14} /></button>}
  </div>;
}
