import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FECHAS_FILTRO, FILTROS_TAREAS_INICIALES, type FiltrosTareasIA as Filtros } from '@/lib/tareasIA';
import { Priority, type Project, type ProjectFolder, type TeamMember } from '@/types/taskTypes';

interface Props {
  filtros: Filtros;
  cambiar: (filtros: Filtros) => void;
  proyectos: Project[];
  carpetas: ProjectFolder[];
  equipo: TeamMember[];
  total: number;
  deshabilitado: boolean;
}

const PRIORIDADES = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

export default function FiltrosTareasIA({ filtros, cambiar, proyectos, carpetas, equipo, total, deshabilitado }: Props) {
  const [abierto, setAbierto] = useState(false);
  const etiquetas: { campo: keyof Filtros; texto: string }[] = [];
  if (filtros.responsable !== 'mias') etiquetas.push({ campo: 'responsable', texto: filtros.responsable === 'todos' ? 'Todas las accesibles' : filtros.responsable });
  if (filtros.proyecto !== 'todos') etiquetas.push({ campo: 'proyecto', texto: filtros.proyecto === 'sin-proyecto' ? 'Sin proyecto' : proyectos.find((p) => p.id === filtros.proyecto)?.name || 'Proyecto' });
  if (filtros.carpeta !== 'todas') etiquetas.push({ campo: 'carpeta', texto: carpetas.find((p) => p.id === filtros.carpeta)?.name || 'Carpeta' });
  if (filtros.prioridad !== 'todas') etiquetas.push({ campo: 'prioridad', texto: `Prioridad ${PRIORIDADES[filtros.prioridad]?.toLowerCase()}` });
  if (filtros.fecha !== 'todas') etiquetas.push({ campo: 'fecha', texto: FECHAS_FILTRO.find((f) => f.valor === filtros.fecha)?.texto || 'Fecha' });

  return <div className="tia-filtros">
    <div className="tia-filtros-barra">
      <button className="tia-boton" disabled={deshabilitado} onClick={() => setAbierto(true)} aria-haspopup="dialog"><SlidersHorizontal size={13} /> Filtros{etiquetas.length > 0 && <span className="tia-filtros-numero">{etiquetas.length}</span>}</button>
      {etiquetas.length > 0 && <button className="tia-enlace" onClick={() => cambiar({ ...FILTROS_TAREAS_INICIALES })}>Limpiar filtros</button>}
    </div>
    {!!etiquetas.length && <div className="tia-filtros-etiquetas" aria-label="Filtros activos">{etiquetas.map(({ campo, texto }) => <button key={campo} aria-label={`Quitar filtro: ${texto}`} onClick={() => cambiar({ ...filtros, [campo]: FILTROS_TAREAS_INICIALES[campo] })}><span>{texto}</span><X size={12} /></button>)}</div>}
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="tia-dialogo tia-filtros-dialogo">
        <DialogHeader><DialogTitle>Filtrar tareas</DialogTitle><DialogDescription>Combina filtros para encontrar lo que necesitas. El responsable incluye tareas compartidas.</DialogDescription></DialogHeader>
        <div className="tia-formulario">
          <label>Responsable<select aria-label="Filtrar por responsable" value={filtros.responsable} onChange={(e) => cambiar({ ...filtros, responsable: e.target.value })}><option value="mias">Mis tareas</option><option value="todos">Todas las accesibles</option>{equipo.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</select></label>
          <div className="tia-form-dos">
            <label>Carpeta<select aria-label="Filtrar por carpeta" value={filtros.carpeta} onChange={(e) => cambiar({ ...filtros, carpeta: e.target.value, proyecto: 'todos' })}><option value="todas">Todas las carpetas</option>{carpetas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Proyecto<select aria-label="Filtrar por proyecto" value={filtros.proyecto} onChange={(e) => cambiar({ ...filtros, proyecto: e.target.value })}><option value="todos">Todos los proyectos</option>{filtros.carpeta === 'todas' && <option value="sin-proyecto">Sin proyecto</option>}{proyectos.filter((p) => filtros.carpeta === 'todas' || p.folderId === filtros.carpeta).map((p) => <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (archivado)' : ''}</option>)}</select></label>
          </div>
          <div className="tia-form-dos">
            <label>Prioridad<select aria-label="Filtrar por prioridad" value={filtros.prioridad} onChange={(e) => cambiar({ ...filtros, prioridad: e.target.value })}><option value="todas">Todas las prioridades</option>{Object.values(Priority).map((p) => <option key={p} value={p}>{PRIORIDADES[p]}</option>)}</select></label>
            <label>Fecha de entrega<select aria-label="Filtrar por fecha" value={filtros.fecha} onChange={(e) => cambiar({ ...filtros, fecha: e.target.value as Filtros['fecha'] })}>{FECHAS_FILTRO.map((f) => <option key={f.valor} value={f.valor}>{f.texto}</option>)}</select></label>
          </div>
        </div>
        <p className="tia-filtros-nota">El estado se elige en las pestañas de la lista. La carga del equipo muestra todas sus tareas activas.</p>
        <div className="tia-form-pie"><button className="tia-boton" onClick={() => cambiar({ ...FILTROS_TAREAS_INICIALES })}>Restablecer</button><button className="tia-boton tia-boton-azul" onClick={() => setAbierto(false)}>Ver {total} {total === 1 ? 'tarea' : 'tareas'}</button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
