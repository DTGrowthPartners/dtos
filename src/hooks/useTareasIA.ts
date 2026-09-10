import { useEffect, useRef, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/auth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useToast } from '@/hooks/use-toast';
import { createTask, loadProjects, sendHighPriorityTaskToWhatsApp, sendTaskNotification } from '@/lib/firestoreTaskService';
import { etiquetaFecha } from '@/lib/tareasIA';
import { esMismoMiembro, esResponsable, matchTeamMember, Priority, TaskStatus, type Project, type Task } from '@/types/taskTypes';

export function useTareasIA() {
  const { user } = useAuthStore();
  const equipo = useTeamMembers();
  const { toast } = useToast();
  const nombre = matchTeamMember(equipo, user?.firstName, user?.email) || user?.firstName || '';
  const [tareas, setTareas] = useState<Task[]>([]);
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const bloqueo = useRef(false);

  useEffect(() => {
    let activo = true;
    let tareasListas = false;
    let proyectosListos = false;
    setCargando(true);
    setError('');
    const terminar = () => { if (activo && tareasListas && proyectosListos) setCargando(false); };
    const cancelar = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      if (!activo) return;
      setTareas(snapshot.docs.map((registro) => ({ ...registro.data(), id: registro.id } as Task)).filter((t) => !t.deletedAt));
      tareasListas = true;
      terminar();
    }, () => {
      if (!activo) return;
      setError('No se pudieron cargar las tareas. Revisa tu conexión y vuelve a intentar.');
      setCargando(false);
    });
    loadProjects().then((datos) => {
      if (!activo) return;
      setProyectos(datos);
      proyectosListos = true;
      terminar();
    }).catch(() => {
      if (!activo) return;
      setError('No se pudieron cargar los proyectos. Vuelve a intentar.');
      setCargando(false);
    });
    return () => { activo = false; cancelar(); };
  }, [intento]);

  const puedeEditar = (tarea: Task) => !!nombre && (user?.role?.toLowerCase() === 'admin'
    || esResponsable(tarea, nombre) || esResponsable({ assignee: tarea.creator }, nombre));

  const avisarAsignacion = (tarea: Task, evento: 'creada' | 'actualizada') => {
    if (esMismoMiembro(tarea.assignee, nombre)) return;
    void sendTaskNotification({ type: 'task_assigned', taskTitle: tarea.title, taskId: tarea.id, assigneeName: tarea.assignee, senderName: nombre });
    void sendHighPriorityTaskToWhatsApp({
      id: tarea.id, titulo: tarea.title, descripcion: tarea.description || '',
      prioridad: tarea.priority === Priority.HIGH ? 'Alta' : tarea.priority === Priority.LOW ? 'Baja' : 'Media',
      asignado: tarea.assignee, creador: tarea.creator || nombre,
      proyecto: proyectos.find((p) => p.id === tarea.projectId)?.name || 'Sin proyecto',
      fechaLimite: tarea.dueDate ? etiquetaFecha(tarea.dueDate) : null, evento,
    });
  };

  const ejecutar = async (clave: string, accion: () => Promise<void>): Promise<boolean> => {
    if (bloqueo.current || !nombre || cargando || error) return false;
    bloqueo.current = true;
    setOcupado(clave);
    try {
      await accion();
      window.dispatchEvent(new Event('dtos:tasks-changed'));
      return true;
    } catch (fallo) {
      toast({ title: 'No se pudo guardar', description: fallo instanceof Error ? fallo.message : 'Vuelve a intentar.', variant: 'destructive' });
      return false;
    } finally {
      bloqueo.current = false;
      setOcupado(null);
    }
  };

  const crear = (datos: Omit<Task, 'id' | 'createdAt' | 'creator'>) => ejecutar('crear', async () => {
    if (!datos.title.trim()) throw new Error('Escribe un título para la tarea.');
    if (!equipo.some((m) => m.name === datos.assignee)) throw new Error('Selecciona un responsable del equipo.');
    const id = await createTask({ ...datos, title: datos.title.trim(), creator: nombre });
    avisarAsignacion({ ...datos, id, creator: nombre, createdAt: Date.now() }, 'creada');
    toast({ title: 'Tarea creada', description: `Asignada a ${datos.assignee}. Ya está en Operaciones.` });
  });

  const asignar = (id: string, responsable: string) => ejecutar(id, async () => {
    if (!equipo.some((m) => m.name === responsable)) throw new Error('Selecciona un responsable del equipo.');
    const resultado = await runTransaction(db, async (transaccion) => {
      const referencia = doc(db, 'tasks', id);
      const registro = await transaccion.get(referencia);
      const tarea = { ...registro.data(), id } as Task;
      if (!registro.exists() || tarea.deletedAt || !puedeEditar(tarea)) throw new Error('Esta tarea ya no está disponible para asignar.');
      if (tarea.status === TaskStatus.DONE) throw new Error('Reabre la tarea antes de delegarla.');
      if (esMismoMiembro(tarea.assignee, responsable)) return null;
      // Conserva el segundo responsable, evitando duplicarlo al pasar a principal.
      const cambios = { assignee: responsable, coAssignee: esMismoMiembro(tarea.coAssignee, responsable) ? null : tarea.coAssignee || null };
      transaccion.update(referencia, cambios);
      return { ...tarea, ...cambios };
    });
    if (resultado) {
      avisarAsignacion(resultado, 'actualizada');
      toast({ title: `Tarea asignada a ${responsable}`, description: resultado.title });
    }
  });

  const cambiarEstado = (id: string, estado: TaskStatus) => ejecutar(id, async () => {
    const resultado = await runTransaction(db, async (transaccion) => {
      const referencia = doc(db, 'tasks', id);
      const registro = await transaccion.get(referencia);
      const tarea = { ...registro.data(), id } as Task;
      if (!registro.exists() || tarea.deletedAt || !puedeEditar(tarea)) throw new Error('Esta tarea ya no está disponible.');
      if (tarea.status === estado) return null;
      const ahora = Date.now();
      if (estado === TaskStatus.DONE) {
        // El archivo y el estado cambian juntos: un fallo no deja un historial duplicado.
        transaccion.set(doc(collection(db, 'completed_tasks')), { ...registro.data(), id, originalId: id, status: estado, completedAt: ahora });
        if (tarea.recurrence?.enabled && (!tarea.dueDate || tarea.dueDate >= ahora)) {
          const siguiente = new Date(tarea.dueDate || ahora);
          const frecuencia = tarea.recurrence.frequency;
          if (frecuencia === 'monthly') siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
          else siguiente.setUTCDate(siguiente.getUTCDate() + (frecuencia === 'daily' ? 1 : frecuencia === 'weekly' ? 7 : 14));
          transaccion.update(referencia, {
            status: TaskStatus.TODO, dueDate: siguiente.getTime(), completedAt: deleteField(),
            recurrence: { ...tarea.recurrence, nextOccurrence: siguiente.getTime(), lastGenerated: ahora },
          });
          return { tarea, siguiente: siguiente.getTime() };
        }
      }
      transaccion.update(referencia, { status: estado, completedAt: estado === TaskStatus.DONE ? ahora : deleteField() });
      return { tarea, siguiente: undefined as number | undefined };
    });
    if (!resultado) return;
    if (estado === TaskStatus.DONE && resultado.tarea.creator && !esMismoMiembro(resultado.tarea.creator, nombre)) {
      void sendTaskNotification({ type: 'task_completed', taskTitle: resultado.tarea.title, taskId: id, assigneeName: resultado.tarea.creator, senderName: nombre });
    }
    toast({ title: estado === TaskStatus.DONE ? 'Tarea completada' : 'Estado actualizado', description: resultado.siguiente ? `Próxima repetición: ${etiquetaFecha(resultado.siguiente)}.` : undefined });
  });

  return { tareas, proyectos, equipo, nombre, cargando, error, ocupado, crear, asignar, cambiarEstado, reintentar: () => setIntento((v) => v + 1) };
}
