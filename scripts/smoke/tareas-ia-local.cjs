// Pruebas locales: reemplazan Firestore y notificaciones; nunca conectan a producción.
// Ejecutar desde la raíz: node scripts/smoke/tareas-ia-local.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const raiz = path.resolve(__dirname, '../..');

function cargar(archivo, modulos = {}, globales = {}) {
  const fuente = fs.readFileSync(path.join(raiz, archivo), 'utf8');
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports,
    require: (nombre) => { if (!(nombre in modulos)) throw new Error(`Importación no simulada: ${nombre}`); return modulos[nombre]; },
    console, Date, Event, ...globales,
  }, { filename: archivo });
  return modulo.exports;
}

const tipos = cargar('src/types/taskTypes.ts');
const fechas = cargar('src/lib/tareasIA.ts', { '@/types/taskTypes': tipos });
const tareasIniciales = () => ({
  propia: { id: 'propia', title: 'Revisar propuesta', description: '', assignee: 'Stiven', coAssignee: 'Jhonathan', creator: 'Dairo', status: 'TODO', priority: 'HIGH', projectId: '', createdAt: 1 },
  ajena: { id: 'ajena', title: 'Tarea privada', assignee: 'Dairo', creator: 'Dairo', status: 'TODO', priority: 'LOW', projectId: '', createdAt: 1 },
});

function preparar(datos = tareasIniciales(), fallar = false) {
  const almacen = structuredClone(datos);
  const archivo = [];
  const avisos = [];
  const mensajes = [];
  let estado = 0;
  let escrituras = 0;
  const firestore = {
    collection: (_db, nombre) => ({ coleccion: nombre }),
    doc: (base, coleccion, id) => typeof coleccion === 'string' ? { coleccion, id } : { coleccion: base.coleccion, id: 'archivo' },
    deleteField: () => '__BORRAR__',
    onSnapshot: () => () => {},
    runTransaction: async (_db, funcion) => {
      const pendientes = [];
      const resultado = await funcion({
        get: async (ref) => ({ exists: () => !!almacen[ref.id], data: () => almacen[ref.id] }),
        set: (ref, valor) => pendientes.push({ ref, valor, nuevo: true }),
        update: (ref, valor) => pendientes.push({ ref, valor }),
      });
      if (fallar) throw new Error('Sin conexión');
      for (const cambio of pendientes) {
        escrituras++;
        if (cambio.nuevo) archivo.push(cambio.valor);
        else for (const [clave, valor] of Object.entries(cambio.valor)) {
          if (valor === '__BORRAR__') delete almacen[cambio.ref.id][clave];
          else almacen[cambio.ref.id][clave] = valor;
        }
      }
      return resultado;
    },
  };
  const { useTareasIA } = cargar('src/hooks/useTareasIA.ts', {
    react: { useEffect: () => {}, useState: (valor) => [estado++ === 2 ? false : valor, () => {}], useRef: (valor) => ({ current: valor }) },
    'firebase/firestore': firestore,
    '@/lib/firebase': { db: {} },
    '@/lib/auth': { useAuthStore: () => ({ user: { firstName: 'Stiven', email: 'stiven@example.test', role: 'user' } }) },
    '@/hooks/useTeamMembers': { useTeamMembers: () => ['Stiven', 'Dairo', 'Jhonathan'].map((name) => ({ name })) },
    '@/hooks/use-toast': { useToast: () => ({ toast: (valor) => mensajes.push(valor) }) },
    '@/lib/firestoreTaskService': {
      createTask: async (valor) => { almacen.nueva = valor; return 'nueva'; },
      loadProjects: async () => [],
      loadProjectFolders: async () => [],
      sendTaskNotification: async (valor) => avisos.push(valor),
      sendHighPriorityTaskToWhatsApp: async (valor) => avisos.push(valor),
    },
    '@/lib/tareasIA': fechas,
    '@/types/taskTypes': tipos,
  }, { window: { dispatchEvent: () => {} } });
  return { hook: useTareasIA(), almacen, archivo, avisos, mensajes, escrituras: () => escrituras };
}

(async () => {
  assert.equal(fechas.fechaColombia(Date.parse('2026-09-11T02:00:00Z')), '2026-09-10');
  assert.equal(fechas.fechaDeFormulario('2026-09-10', '00:00'), Date.parse('2026-09-10T05:00:00Z'));
  assert.equal(fechas.fechaDeFormulario('2026-02-30'), undefined);
  assert.equal(fechas.fechaDeFormulario(''), undefined);
  assert.equal(fechas.fechaColombia(fechas.fechaDeFormulario('2028-02-29', '23:59')), '2028-02-29');
  const muestra = tareasIniciales().propia;
  const vencida = { ...muestra, priority: 'LOW', dueDate: Date.now() - 86400_000 };
  const futura = { ...muestra, priority: 'HIGH', dueDate: Date.now() + 86400_000 };
  assert.ok(fechas.ordenarPorUrgencia(vencida, futura) < 0);

  const ahora = Date.parse('2026-09-12T02:00:00Z'); // Viernes 11 en Colombia.
  const proyectos = [{ id: 'web', folderId: 'clientes' }, { id: 'inbox', folderId: 'interno' }];
  const casos = [
    { ...muestra, id: 'hoy', projectId: 'web', dueDate: Date.parse('2026-09-12T04:59:00Z') },
    { ...muestra, id: 'vencida', projectId: 'web', priority: 'LOW', dueDate: Date.parse('2026-09-10T17:00:00Z') },
    { ...muestra, id: 'hecha', status: 'DONE', dueDate: Date.parse('2026-09-10T17:00:00Z') },
    { ...muestra, id: 'sabado', dueDate: Date.parse('2026-09-13T04:59:00Z') },
    { ...muestra, id: 'domingo', dueDate: Date.parse('2026-09-13T05:00:00Z') },
    { ...muestra, id: 'mes-siguiente', dueDate: Date.parse('2026-10-01T05:00:00Z') },
    { ...muestra, id: 'sin-fecha', title: 'Revisión editorial', description: 'Diseño de campaña', projectId: 'inbox' },
    { ...muestra, id: 'delegada', assignee: 'Dairo', coAssignee: null, creator: 'Stiven' },
    { ...muestra, id: 'borrada', deletedAt: ahora },
    tareasIniciales().ajena,
  ];
  const filtrar = (cambios = {}, admin = false, busqueda = '') => Array.from(fechas.filtrarTareasIA(casos, proyectos, 'Stiven', admin, { ...fechas.FILTROS_TAREAS_INICIALES, ...cambios }, busqueda, ahora), (t) => t.id);
  assert.deepEqual(filtrar({ fecha: 'hoy' }), ['hoy']);
  assert.deepEqual(filtrar({ fecha: 'vencidas' }), ['vencida']);
  assert.deepEqual(filtrar({ fecha: 'sin-fecha' }), ['sin-fecha']);
  assert.ok(filtrar({ fecha: 'semana' }).includes('sabado'));
  assert.ok(!filtrar({ fecha: 'semana' }).includes('domingo'));
  assert.ok(!filtrar({ fecha: 'mes' }).includes('mes-siguiente'));
  assert.deepEqual(filtrar({ carpeta: 'clientes', proyecto: 'web', prioridad: 'HIGH', fecha: 'hoy' }), ['hoy']);
  assert.deepEqual(filtrar({}, false, ' diseno de campana '), ['sin-fecha']);
  assert.deepEqual(filtrar({ responsable: 'Dairo' }), ['delegada']);
  assert.ok(filtrar({ responsable: 'todos' }).includes('delegada'));
  assert.ok(!filtrar({ responsable: 'todos' }).includes('ajena'));
  assert.ok(filtrar({ responsable: 'todos' }, true).includes('ajena'));
  assert.ok(!filtrar({ responsable: 'todos' }, true).includes('borrada'));
  assert.ok(filtrar({ responsable: 'Jhonathan' }).includes('hoy')); // Segundo responsable.
  assert.equal(fechas.puedeVerTareaIA({ ...muestra, assignee: 'Jose Maria', coAssignee: null }, 'Jose', false), false);

  let prueba = preparar();
  assert.equal(await prueba.hook.asignar('propia', 'Jhonathan'), true);
  assert.equal(prueba.almacen.propia.assignee, 'Jhonathan');
  assert.equal(prueba.almacen.propia.coAssignee, null);
  assert.equal(prueba.avisos.length, 2);

  prueba = preparar();
  await prueba.hook.asignar('propia', 'Dairo');
  assert.equal(prueba.almacen.propia.coAssignee, 'Jhonathan');
  await prueba.hook.asignar('propia', 'Dairo');
  assert.equal(prueba.escrituras(), 1);
  assert.equal(prueba.avisos.length, 2);

  prueba = preparar();
  assert.equal(await prueba.hook.asignar('ajena', 'Stiven'), false);
  assert.equal(await prueba.hook.cambiarEstado('ajena', 'DONE'), false);
  assert.equal(await prueba.hook.asignar('propia', 'Desconocido'), false);
  assert.equal(prueba.escrituras(), 0);
  assert.equal(prueba.avisos.length, 0);

  prueba = preparar();
  await prueba.hook.cambiarEstado('propia', 'DONE');
  await prueba.hook.cambiarEstado('propia', 'DONE');
  assert.equal(prueba.archivo.length, 1);
  assert.equal(prueba.almacen.propia.status, 'DONE');
  assert.ok(prueba.almacen.propia.completedAt);
  await prueba.hook.cambiarEstado('propia', 'TODO');
  assert.equal(prueba.almacen.propia.completedAt, undefined);

  const datos = tareasIniciales();
  datos.propia.recurrence = { enabled: true, frequency: 'weekly' };
  datos.propia.dueDate = Date.now() + 86400_000;
  prueba = preparar(datos);
  await prueba.hook.cambiarEstado('propia', 'DONE');
  assert.equal(prueba.archivo.length, 1);
  assert.equal(prueba.almacen.propia.status, 'TODO');
  assert.equal(prueba.almacen.propia.dueDate, datos.propia.dueDate + 7 * 86400_000);

  datos.propia.deletedAt = Date.now();
  prueba = preparar(datos);
  assert.equal(await prueba.hook.cambiarEstado('propia', 'DONE'), false);
  assert.equal(prueba.escrituras(), 0);

  prueba = preparar(tareasIniciales(), true);
  assert.equal(await prueba.hook.cambiarEstado('propia', 'DONE'), false);
  assert.equal(prueba.archivo.length, 0);
  assert.equal(prueba.almacen.propia.status, 'TODO');
  assert.equal(prueba.avisos.length, 0);

  console.log('Tareas IA: filtros combinados, fechas colombianas, responsables y permisos, delegación, historial, recurrencia y fallos verificados sin red.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
