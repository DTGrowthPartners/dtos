import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Check, CheckCheck, ChevronDown, ChevronRight, Circle, Clock3, GripVertical, Inbox, LayoutGrid, ListTodo, Loader2, Plus, Search, Sparkles, Users, X, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTareasIA } from '@/hooks/useTareasIA';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { etiquetaFecha, fechaColombia, fechaDeFormulario, ordenarPorUrgencia } from '@/lib/tareasIA';
import { esMismoMiembro, esResponsable, Priority, TASK_TYPES, TaskStatus, type TaskType } from '@/types/taskTypes';
import './TareasIA.css';

const TIPO_ARRASTRE = 'application/x-dtos-tarea-ia';
const ESTADOS = [
  { valor: TaskStatus.TODO, texto: 'Pendientes' },
  { valor: TaskStatus.IN_PROGRESS, texto: 'En progreso' },
  { valor: TaskStatus.DONE, texto: 'Completadas' },
];
const PRIORIDADES = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' };
interface PropuestaIA {
  title: string;
  description?: string;
  assignee?: string | null;
  priority?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  type?: string | null;
}
interface Borrador {
  titulo: string;
  descripcion: string;
  responsable: string;
  proyecto: string;
  prioridad: Priority;
  fecha: string;
  hora: string;
  tipo?: TaskType;
  propuesta?: number;
}

export default function TareasIA() {
  const { tareas, proyectos, equipo, nombre, cargando, error, ocupado, crear, asignar, cambiarEstado, reintentar } = useTareasIA();
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState(TaskStatus.TODO);
  const [rapida, setRapida] = useState('');
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [interpretando, setInterpretando] = useState(false);
  const [errorIA, setErrorIA] = useState('');
  const [peticion, setPeticion] = useState('');
  const [propuestas, setPropuestas] = useState<PropuestaIA[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [verEquipo, setVerEquipo] = useState(false);
  const [prioridades, setPrioridades] = useState(false);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [asignarA, setAsignarA] = useState<string | null>(null);
  const [buscarAsignacion, setBuscarAsignacion] = useState('');
  const [panelMovil, setPanelMovil] = useState<'asistente' | 'tareas'>('asistente');
  const entradaIA = useRef<HTMLTextAreaElement>(null);
  const panelEquipo = useRef<HTMLElement>(null);
  const bloqueoIA = useRef(false);

  const propias = useMemo(() => tareas.filter((t) => esResponsable(t, nombre)), [tareas, nombre]);
  const activas = propias.filter((t) => t.status !== TaskStatus.DONE);
  const visibles = propias.filter((t) => t.status === estado && `${t.title} ${t.description || ''}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'))).sort(ordenarPorUrgencia);
  const tarea = propias.find((t) => t.id === seleccionada);
  const proyectoPorDefecto = proyectos.find((p) => !p.archived && /^\s*inbox\s*$/i.test(p.name))?.id || '';
  const equipoConCarga = equipo.map((miembro) => ({ ...miembro, carga: tareas.filter((t) => t.status !== TaskStatus.DONE && esResponsable(t, miembro.name)).length }));
  const maxCarga = Math.max(1, ...equipoConCarga.map((m) => m.carga));
  const equipoVisible = verEquipo ? equipoConCarga : equipoConCarga.slice(0, 4);
  const deshabilitado = cargando || !!error || !!ocupado || !nombre;

  const abrirNueva = (responsable = nombre, propuesta?: PropuestaIA, indice?: number) => {
    const miembro = propuesta?.assignee ? equipo.find((m) => esMismoMiembro(m.name, propuesta.assignee)) : undefined;
    setBorrador({
      titulo: propuesta?.title || '', descripcion: propuesta?.description || '',
      responsable: miembro?.name || responsable, proyecto: proyectoPorDefecto,
      prioridad: Object.values(Priority).includes(propuesta?.priority as Priority) ? propuesta.priority as Priority : Priority.MEDIUM,
      fecha: propuesta?.dueDate && fechaDeFormulario(propuesta.dueDate) ? propuesta.dueDate : '',
      hora: propuesta?.dueTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(propuesta.dueTime) ? propuesta.dueTime : '12:00',
      tipo: TASK_TYPES.includes(propuesta?.type as TaskType) ? propuesta.type as TaskType : undefined,
      propuesta: indice,
    });
  };

  const crearRapida = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!rapida.trim() || deshabilitado) return;
    const ok = await crear({ title: rapida.trim(), description: '', assignee: nombre, projectId: proyectoPorDefecto, priority: Priority.MEDIUM, status: TaskStatus.TODO, origen: 'rapida' });
    if (ok) { setRapida(''); setEstado(TaskStatus.TODO); }
  };

  const guardarBorrador = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!borrador || deshabilitado) return;
    const vencimiento = fechaDeFormulario(borrador.fecha, borrador.hora);
    if (borrador.fecha && !vencimiento) {
      toast({ title: 'Revisa la fecha y la hora', variant: 'destructive' });
      return;
    }
    const ok = await crear({ title: borrador.titulo, description: borrador.descripcion, assignee: borrador.responsable,
      projectId: borrador.proyecto, priority: borrador.prioridad, status: TaskStatus.TODO, dueDate: vencimiento, type: borrador.tipo });
    if (ok) {
      if (borrador.propuesta !== undefined) setPropuestas((anteriores) => anteriores.filter((_, i) => i !== borrador.propuesta));
      setBorrador(null);
    }
  };

  const interpretar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!texto.trim() || bloqueoIA.current || deshabilitado || propuestas.length) return;
    bloqueoIA.current = true;
    setInterpretando(true);
    setErrorIA('');
    setSeleccionada(null);
    setPrioridades(false);
    try {
      const respuesta = await apiClient.post<{ success: boolean; tasks?: PropuestaIA[]; error?: string }>('/api/tasks-ai/parse-list', { text: texto.trim() });
      const resultados = respuesta.tasks?.filter((t) => typeof t.title === 'string' && t.title.trim());
      if (!respuesta.success || !resultados?.length) throw new Error(respuesta.error || 'No encontré una tarea. Describe qué hay que hacer y para quién.');
      setPropuestas(resultados);
      setPeticion(texto.trim());
      setTexto('');
    } catch (fallo) {
      setErrorIA(fallo instanceof Error ? fallo.message : 'No se pudo conectar con la IA. Vuelve a intentar.');
    } finally {
      bloqueoIA.current = false;
      setInterpretando(false);
    }
  };

  const delegar = async (id: string, responsable: string) => {
    const ok = await asignar(id, responsable);
    if (ok) { setSeleccionada(null); setAsignarA(null); }
    setArrastrada(null);
    setDestino(null);
  };

  const elegirAsignacion = (responsable: string) => {
    if (tarea && tarea.status !== TaskStatus.DONE) void delegar(tarea.id, responsable);
    else { setBuscarAsignacion(''); setAsignarA(responsable); }
  };

  const enfocarIA = () => { setPanelMovil('asistente'); entradaIA.current?.focus(); };
  const hayContenido = !!tarea || prioridades || propuestas.length > 0;

  return (
    <div className="tareas-ia">
      <nav className="tia-movil-nav" aria-label="Panel de Tareas IA">
        <button aria-pressed={panelMovil === 'tareas'} onClick={() => setPanelMovil('tareas')}><ListTodo size={16} /> Mis tareas <span>{propias.length}</span></button>
        <button aria-pressed={panelMovil === 'asistente'} onClick={() => setPanelMovil('asistente')}><Sparkles size={16} /> Asistente</button>
      </nav>

      <aside className={cn('tia-lista', panelMovil === 'tareas' && 'tia-panel-visible')} aria-label="Mis tareas">
        <div className="tia-lista-cabecera">
          <div className="tia-fila"><h1>Mis tareas</h1><Link to="/mis-tareas" className="tia-icono" aria-label="Abrir la vista Mis tareas" title="Abrir Mis tareas"><ArrowRight size={17} /></Link></div>
          <p>{cargando ? 'Cargando tu espacio…' : `${activas.length} activas · ${propias.filter((t) => t.status === TaskStatus.DONE).length} completadas`}</p>
          <form className="tia-rapida" onSubmit={crearRapida}>
            <input aria-label="Título de una tarea rápida" placeholder="Agregar una tarea y Enter…" value={rapida} maxLength={300} onChange={(e) => setRapida(e.target.value)} disabled={deshabilitado} />
            <button type="submit" className="tia-boton-azul tia-icono" disabled={!rapida.trim() || deshabilitado} aria-label="Crear tarea rápida">{ocupado === 'crear' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={19} />}</button>
          </form>
          <div className="tia-busqueda"><Search size={14} /><input aria-label="Buscar en mis tareas" placeholder="Buscar en mis tareas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        </div>
        <div className="tia-pestanas" role="tablist" aria-label="Estado de las tareas">
          {ESTADOS.map((opcion, indice) => <button key={opcion.valor} role="tab" id={`tia-tab-${opcion.valor}`} tabIndex={estado === opcion.valor ? 0 : -1} aria-selected={estado === opcion.valor} aria-controls="tia-resultados" onClick={() => setEstado(opcion.valor)}
            onKeyDown={(e) => {
              const siguiente = e.key === 'ArrowRight' ? (indice + 1) % ESTADOS.length : e.key === 'ArrowLeft' ? (indice + ESTADOS.length - 1) % ESTADOS.length : e.key === 'Home' ? 0 : e.key === 'End' ? ESTADOS.length - 1 : -1;
              if (siguiente < 0) return;
              e.preventDefault(); setEstado(ESTADOS[siguiente].valor);
              document.getElementById(`tia-tab-${ESTADOS[siguiente].valor}`)?.focus();
            }}>{opcion.texto}<span>{propias.filter((t) => t.status === opcion.valor).length}</span></button>)}
        </div>
        <div className="tia-resultados" id="tia-resultados" role="tabpanel" aria-labelledby={`tia-tab-${estado}`} aria-busy={cargando}>
          {cargando ? <div className="tia-vacio" role="status"><Loader2 className="animate-spin" size={22} /><p>Cargando tus tareas…</p></div>
            : error ? <div className="tia-vacio" role="alert"><Inbox size={25} /><p>{error}</p><button className="tia-boton" onClick={reintentar}>Volver a intentar</button></div>
            : visibles.length === 0 ? <div className="tia-vacio"><CheckCheck size={28} /><p>{busqueda ? 'No hay tareas con esa búsqueda.' : estado === TaskStatus.DONE ? 'Tus tareas completadas aparecerán aquí.' : 'Todo despejado por aquí.'}</p>{!busqueda && estado === TaskStatus.TODO && <button className="tia-enlace" onClick={() => abrirNueva()}>Crear una tarea <Plus size={14} /></button>}</div>
            : visibles.map((item) => {
              const proyecto = proyectos.find((p) => p.id === item.projectId);
              const vencida = item.status !== TaskStatus.DONE && !!item.dueDate && fechaColombia(item.dueDate) < fechaColombia();
              return <div key={item.id} className={cn('tia-tarea', seleccionada === item.id && 'tia-tarea-seleccionada', arrastrada === item.id && 'tia-tarea-arrastrada')}>
                <button className={cn('tia-completar', item.status === TaskStatus.DONE && 'tia-completada')} disabled={deshabilitado} aria-label={`${item.status === TaskStatus.DONE ? 'Reabrir' : 'Completar'} ${item.title}`} onClick={() => void cambiarEstado(item.id, item.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE)}>{ocupado === item.id ? <Loader2 size={17} className="animate-spin" /> : item.status === TaskStatus.DONE ? <Check size={16} /> : item.status === TaskStatus.IN_PROGRESS ? <Clock3 size={17} /> : <Circle size={17} />}</button>
                {/* Un button permite el arrastre nativo junto al To-Do global de hello-pangea. */}
                <button className="tia-tarea-contenido" draggable={!deshabilitado && item.status !== TaskStatus.DONE} aria-pressed={seleccionada === item.id}
                  onDragStart={(e) => { e.dataTransfer.setData(TIPO_ARRASTRE, item.id); e.dataTransfer.effectAllowed = 'move'; setArrastrada(item.id); }}
                  onDragEnd={() => { setArrastrada(null); setDestino(null); }}
                  onClick={() => { setSeleccionada(item.id); setPrioridades(false); setPanelMovil('asistente'); }}>
                  <span className={cn('tia-tarea-titulo', item.status === TaskStatus.DONE && 'tia-tachada')}>{item.title}</span>
                  <span className="tia-tarea-meta"><i className={cn('tia-punto', proyecto?.color || 'bg-blue-500')} /><span>{proyecto?.name || item.type || 'Sin proyecto'}</span>{vencida && <span className="tia-vencida">Vencida</span>}{!vencida && item.priority === Priority.HIGH && <span className="tia-prioridad-alta">Alta</span>}</span>
                </button>
                <GripVertical size={13} className="tia-agarre" aria-hidden="true" />
              </div>;
            })}
        </div>
        <div className="tia-lista-pie"><GripVertical size={13} /><span>Arrastra una tarea al equipo para delegarla</span></div>
      </aside>

      <div className={cn('tia-espacio', panelMovil === 'asistente' && 'tia-panel-visible')}>
        <header className="tia-espacio-cabecera"><span><Sparkles size={15} /> Tareas IA <span className="tia-etiqueta">ASISTENTE</span></span><Link to="/tareas"><LayoutGrid size={14} /> Operaciones <ArrowRight size={14} /></Link></header>
        {error && <div className="tia-error" role="alert">{error} <button className="tia-enlace" onClick={reintentar}>Reintentar</button></div>}

        <section className={cn('tia-asistente', hayContenido && 'tia-asistente-con-contenido')} aria-label="Asistente de tareas">
          {!hayContenido && <div className="tia-bienvenida">
            <div className="tia-emblema"><Zap size={30} strokeWidth={1.6} /></div>
            <h2>Enfócate en lo importante<span>.</span></h2>
            <p>De una idea a una tarea. De tu lista a tu equipo.</p>
            <div className="tia-atajos">
              <button onClick={enfocarIA}><Sparkles size={14} /> Crear con IA</button>
              <button disabled={cargando || !!error} onClick={() => setPrioridades(true)}><ListTodo size={14} /> Ver mis prioridades</button>
              <button onClick={() => panelEquipo.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' })}><Users size={14} /> Repartir trabajo</button>
            </div>
          </div>}

          {tarea && <article className="tia-detalle">
            <div className="tia-fila"><span className="tia-sobretitulo">TAREA SELECCIONADA</span><button className="tia-icono" onClick={() => setSeleccionada(null)} aria-label="Cerrar detalle de tarea"><X size={17} /></button></div>
            <h2>{tarea.title}</h2><p className="tia-descripcion">{tarea.description || 'Esta tarea todavía no tiene descripción.'}</p>
            <div className="tia-detalle-meta"><span>{proyectos.find((p) => p.id === tarea.projectId)?.name || 'Sin proyecto'}</span><span><Clock3 size={13} />{etiquetaFecha(tarea.dueDate)}</span><span>Prioridad {PRIORIDADES[tarea.priority]?.toLowerCase() || 'media'}</span></div>
            <div className="tia-detalle-acciones"><label>Estado<select aria-label="Estado de la tarea seleccionada" value={tarea.status} disabled={deshabilitado} onChange={(e) => void cambiarEstado(tarea.id, e.target.value as TaskStatus)}>{ESTADOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}{!ESTADOS.some((s) => s.valor === tarea.status) && <option value={tarea.status}>{tarea.status}</option>}</select></label><p><ArrowDown size={14} /> Elige una persona abajo para delegar.</p><Link className="tia-enlace" to={`/tareas?taskId=${encodeURIComponent(tarea.id)}`}>Abrir en Operaciones <ArrowRight size={13} /></Link></div>
          </article>}

          {prioridades && <article className="tia-prioridades">
            <div className="tia-fila"><h2>Tu próximo paso</h2><button className="tia-icono" onClick={() => setPrioridades(false)} aria-label="Cerrar prioridades"><X size={17} /></button></div>
            <p>Primero las vencidas, después la prioridad y la fecha de entrega.</p>
            {activas.length ? [...activas].sort(ordenarPorUrgencia).slice(0, 4).map((item, i) => <button key={item.id} className="tia-prioridad-fila" onClick={() => { setSeleccionada(item.id); setPrioridades(false); }}><span>{String(i + 1).padStart(2, '0')}</span><strong>{item.title}</strong><small>{etiquetaFecha(item.dueDate)}</small><ChevronRight size={15} /></button>) : <p className="tia-vacio">No tienes tareas activas. Puedes preparar tu siguiente tarea con IA.</p>}
          </article>}

          {propuestas.length > 0 && <div className="tia-propuestas" aria-live="polite">
            <p className="tia-peticion">{peticion}</p>
            <div className="tia-fila"><span><Sparkles size={15} /> {propuestas.length === 1 ? 'Tengo una propuesta para ti' : `${propuestas.length} tareas listas para revisar`}</span><button className="tia-enlace" onClick={() => { setPropuestas([]); setPeticion(''); }}>Descartar</button></div>
            {propuestas.map((propuesta, indice) => <article className="tia-propuesta" key={`${indice}-${propuesta.title}`}><div><span className="tia-sobretitulo">PROPUESTA · SIN CREAR</span><h3>{propuesta.title}</h3><p>{[propuesta.assignee || nombre, PRIORIDADES[propuesta.priority] || 'Media', propuesta.dueDate && fechaDeFormulario(propuesta.dueDate) ? etiquetaFecha(fechaDeFormulario(propuesta.dueDate)) : 'Sin fecha'].join(' · ')}</p></div><button className="tia-boton" disabled={deshabilitado} onClick={() => abrirNueva(nombre, propuesta, indice)}>Revisar y crear <ArrowRight size={14} /></button></article>)}
          </div>}

          <form className="tia-compositor" onSubmit={interpretar}>
            <label htmlFor="tia-prompt" className="sr-only">Describe las tareas que quieres preparar con IA</label>
            <textarea id="tia-prompt" ref={entradaIA} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} disabled={interpretando || deshabilitado || propuestas.length > 0} placeholder="¿Qué necesitas hacer? Describe una tarea o pega tu lista…" rows={2}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
            <div className="tia-compositor-pie"><span><Sparkles size={13} />{interpretando ? 'Preparando tus tareas…' : propuestas.length ? 'Revisa o descarta las propuestas para continuar' : 'La IA propone. Tú decides.'}</span><button type="submit" className="tia-enviar" disabled={!texto.trim() || interpretando || deshabilitado || propuestas.length > 0} aria-label="Preparar tareas con IA">{interpretando ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={19} />}</button></div>
          </form>
          {errorIA && <p className="tia-error" role="alert">{errorIA}</p>}
          <p className="tia-ayuda-compositor">Enter para preparar <span>·</span> Shift + Enter para una nueva línea</p>
        </section>

        <section className={cn('tia-equipo', arrastrada && 'tia-equipo-arrastrando')} ref={panelEquipo} aria-label="Delegar tareas al equipo">
          <header className="tia-equipo-cabecera"><div className="tia-equipo-titulo"><Users size={27} strokeWidth={1.6} /><div><h2>Delegar / Asignar</h2><p>{arrastrada ? 'Suelta la tarea en la bandeja de su nuevo responsable.' : tarea ? `Seleccionada: ${tarea.title}` : 'El trabajo avanza mejor cuando se comparte.'}</p></div></div><button className="tia-enlace" aria-expanded={verEquipo} onClick={() => setVerEquipo(!verEquipo)}>{verEquipo ? 'Ver menos' : 'Ver equipo'}{verEquipo ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></header>
          <div className="tia-equipo-grid">
            {equipoVisible.map((miembro) => <article key={miembro.name} className={cn('tia-miembro', destino === miembro.name && 'tia-miembro-destino')}
              onDragOver={(e) => { if (!deshabilitado && e.dataTransfer.types.includes(TIPO_ARRASTRE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDestino(miembro.name); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDestino(null); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData(TIPO_ARRASTRE); if (id && propias.some((t) => t.id === id) && !deshabilitado) void delegar(id, miembro.name); }}>
              <div className="tia-miembro-identidad"><span className={cn('tia-avatar', miembro.color)}>{miembro.initials}</span><div><h3>{miembro.name}{esMismoMiembro(miembro.name, nombre) && <small> tú</small>}</h3><p>{miembro.role}</p></div><button className="tia-miembro-nueva" aria-label={`Crear tarea para ${miembro.name}`} title="Crear una tarea" disabled={deshabilitado} onClick={() => abrirNueva(miembro.name)}><Plus size={15} /></button></div>
              <div className="tia-carga"><strong>{cargando || error ? '—' : miembro.carga}</strong><span>activas</span><div className="tia-barra" title={`${miembro.carga} tareas activas`}><i style={{ width: `${cargando || error ? 0 : miembro.carga / maxCarga * 100}%` }} /></div></div>
              <button className="tia-bandeja" disabled={deshabilitado} onClick={() => elegirAsignacion(miembro.name)} aria-label={`Asignar tarea a ${miembro.name}`}>
                <span className="tia-papeles" aria-hidden="true"><i /><i /><i /></span>
                <span className="tia-bandeja-frente"><Inbox size={17} /><strong>{destino === miembro.name ? 'Suelta aquí' : tarea && tarea.status !== TaskStatus.DONE ? 'Asignar tarea' : 'Soltar o asignar'}</strong><small>a {miembro.name}</small></span>
              </button>
            </article>)}
          </div>
          <footer><span className="tia-punto bg-blue-500" /> Mismas tareas. Un espacio para enfocarte.</footer>
        </section>
      </div>

      <Dialog open={!!borrador} onOpenChange={(abierto) => { if (!abierto && !ocupado) setBorrador(null); }}>
        <DialogContent className="tia-dialogo" aria-describedby="tia-form-descripcion"><DialogHeader><DialogTitle>{borrador?.propuesta !== undefined ? 'Revisa tu tarea' : 'Nueva tarea'}</DialogTitle><DialogDescription id="tia-form-descripcion">Define los detalles y el responsable antes de crearla.</DialogDescription></DialogHeader>
          {borrador && <form className="tia-formulario" onSubmit={guardarBorrador}><fieldset disabled={!!ocupado}>
            <label>Título<input required maxLength={300} value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} autoFocus /></label>
            <label>Descripción<textarea rows={3} value={borrador.descripcion} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} /></label>
            <div className="tia-form-dos"><label>Responsable<select aria-label="Responsable" value={borrador.responsable} onChange={(e) => setBorrador({ ...borrador, responsable: e.target.value })}>{equipo.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Proyecto<select aria-label="Proyecto" value={borrador.proyecto} onChange={(e) => setBorrador({ ...borrador, proyecto: e.target.value })}><option value="">Sin proyecto</option>{proyectos.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
            <div className="tia-form-dos"><label>Prioridad<select aria-label="Prioridad" value={borrador.prioridad} onChange={(e) => setBorrador({ ...borrador, prioridad: e.target.value as Priority })}>{Object.values(Priority).map((p) => <option key={p} value={p}>{PRIORIDADES[p]}</option>)}</select></label><label>Fecha de entrega<input type="date" value={borrador.fecha} onChange={(e) => setBorrador({ ...borrador, fecha: e.target.value })} /></label></div>
            {borrador.fecha && <label>Hora de entrega (Colombia)<input type="time" required value={borrador.hora} onChange={(e) => setBorrador({ ...borrador, hora: e.target.value })} /></label>}
            <div className="tia-form-pie"><button type="button" className="tia-boton" onClick={() => setBorrador(null)}>Cancelar</button><button className="tia-boton tia-boton-azul" type="submit" disabled={deshabilitado || !borrador.titulo.trim()}>{ocupado ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear tarea</button></div>
          </fieldset></form>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!asignarA} onOpenChange={(abierto) => { if (!abierto && !ocupado) setAsignarA(null); }}><DialogContent className="tia-dialogo"><DialogHeader><DialogTitle>Asignar a {asignarA}</DialogTitle><DialogDescription>Elige una de tus tareas activas para delegarla.</DialogDescription></DialogHeader><div className="tia-busqueda"><Search size={16} /><input aria-label="Buscar tarea para asignar" placeholder="Buscar una tarea…" value={buscarAsignacion} onChange={(e) => setBuscarAsignacion(e.target.value)} /></div><div className="tia-selector-tareas">{activas.filter((t) => t.title.toLocaleLowerCase('es').includes(buscarAsignacion.toLocaleLowerCase('es'))).map((item) => <button disabled={deshabilitado || esMismoMiembro(item.assignee, asignarA)} key={item.id} onClick={() => void delegar(item.id, asignarA)}><span>{item.title}</span>{esMismoMiembro(item.assignee, asignarA) ? <small>Ya asignada</small> : <ArrowRight size={15} />}</button>)}{!activas.some((t) => t.title.toLocaleLowerCase('es').includes(buscarAsignacion.toLocaleLowerCase('es'))) && <p className="tia-vacio">No hay tareas activas con esa búsqueda.</p>}</div><button className="tia-boton tia-boton-azul" disabled={deshabilitado} onClick={() => { const responsable = asignarA; setAsignarA(null); setTimeout(() => abrirNueva(responsable), 0); }}><Plus size={16} /> Crear una nueva para {asignarA}</button></DialogContent></Dialog>
    </div>
  );
}

